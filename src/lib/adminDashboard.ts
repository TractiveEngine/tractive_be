import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import Order from '@/models/order';
import Transaction from '@/models/transaction';
import Farmer from '@/models/farmer';
import Product from '@/models/product';
import ShippingRequest from '@/models/shipping';

export async function getAdminDashboardData() {
  await dbConnect();

  const totalUsers = await User.countDocuments();
  const buyers = await User.countDocuments({ roles: 'buyer' });
  const agents = await User.countDocuments({ roles: 'agent' });
  const transporters = await User.countDocuments({ roles: 'transporter' });
  const admins = await User.countDocuments({ roles: 'admin' });
  const activeUsers = await User.countDocuments({ status: 'active' });
  const suspendedUsers = await User.countDocuments({ status: 'suspended' });

  const totalOrders = await Order.countDocuments();
  const pendingOrders = await Order.countDocuments({ status: 'pending' });
  const paidOrders = await Order.countDocuments({ status: 'paid' });
  const deliveredOrders = await Order.countDocuments({ status: 'delivered' });

  const allTransactions = await Transaction.find({ status: 'approved' });
  const totalRevenue = allTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentTransactions = await Transaction.find({
    status: 'approved',
    createdAt: { $gte: thirtyDaysAgo }
  });
  const last30DaysRevenue = recentTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const transactionsCount = allTransactions.length;

  // Simple revenue chart last 6 months
  const now = new Date();
  const revenueChart = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const amount = allTransactions
      .filter((t) => t.createdAt >= month && t.createdAt < next)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    revenueChart.push({ label: `${month.getFullYear()}-${month.getMonth() + 1}`, amount });
  }

  const buyerOrders = await Order.aggregate([
    {
      $group: {
        _id: '$buyer',
        ordersCount: { $sum: 1 },
        totalSpent: { $sum: '$totalAmount' }
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 10 }
  ]);

  const topBuyersData = await Promise.all(
    buyerOrders.map(async (b) => {
      const buyerUser = await User.findById(b._id);
      return {
        userId: b._id?.toString(),
        name: buyerUser?.name || buyerUser?.businessName || 'Unknown',
        email: buyerUser?.email || '',
        ordersCount: b.ordersCount,
        totalSpent: b.totalSpent
      };
    })
  );

  const agentFarmers = await Farmer.aggregate([
    { $group: { _id: '$createdBy', farmersOnboarded: { $sum: 1 } } }
  ]);

  const agentProducts = await Product.aggregate([
    { $group: { _id: '$owner', productsListed: { $sum: 1 } } }
  ]);

  const agentSales = await Order.aggregate([
    { $unwind: '$products' },
    {
      $lookup: {
        from: 'products',
        localField: 'products.product',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $group: {
        _id: '$productInfo.owner',
        totalSales: { $sum: '$totalAmount' }
      }
    },
    { $sort: { totalSales: -1 } },
    { $limit: 10 }
  ]);

  const topAgentsData = await Promise.all(
    agentSales.map(async (a) => {
      const agentUser = await User.findById(a._id);
      const farmerData = agentFarmers.find((f) => f._id?.toString() === a._id?.toString());
      const productData = agentProducts.find((p) => p._id?.toString() === a._id?.toString());
      return {
        userId: a._id?.toString(),
        name: agentUser?.name || agentUser?.businessName || 'Unknown',
        farmersOnboarded: farmerData?.farmersOnboarded || 0,
        productsListed: productData?.productsListed || 0,
        totalSales: a.totalSales
      };
    })
  );

  const transporterShipments = await ShippingRequest.aggregate([
    { $match: { transporter: { $ne: null } } },
    {
      $group: {
        _id: '$transporter',
        totalShipments: { $sum: 1 },
        totalRevenue: { $sum: '$negotiationPrice' }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 }
  ]);

  const topTransportersData = await Promise.all(
    transporterShipments.map(async (t) => {
      const transporterUser = await User.findById(t._id);
      return {
        userId: t._id?.toString(),
        name: transporterUser?.name || transporterUser?.businessName || 'Unknown',
        totalShipments: t.totalShipments,
        totalRevenue: t.totalRevenue || 0
      };
    })
  );

  return {
    userStats: {
      totalUsers,
      buyers,
      agents,
      transporters,
      admins,
      activeUsers,
      suspendedUsers
    },
    orderStats: {
      totalOrders,
      pending: pendingOrders,
      paid: paidOrders,
      delivered: deliveredOrders
    },
    revenueStats: {
      totalRevenue,
      last30DaysRevenue,
      transactionsCount,
      revenueChart
    },
    topBuyers: topBuyersData,
    topAgents: topAgentsData,
    topTransporters: topTransportersData
  };
}
