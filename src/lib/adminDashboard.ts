import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import Order from '@/models/order';
import Transaction from '@/models/transaction';
import Farmer from '@/models/farmer';
import Product from '@/models/product';
import ShippingRequest from '@/models/shipping';
import FleetPayment from '@/models/fleetPayment';

function computeDeltaPercent(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function getAdminDashboardData(options?: {
  from?: string | null;
  to?: string | null;
  period?: string | null;
  topAgentsLimit?: number;
  topBuyersLimit?: number;
  topTransportersLimit?: number;
}) {
  await dbConnect();

  const parsedFrom = options?.from ? new Date(options.from) : null;
  const parsedTo = options?.to ? new Date(options.to) : null;
  const range: Record<string, Date> = {};
  if (parsedFrom && !Number.isNaN(parsedFrom.getTime())) range.$gte = parsedFrom;
  if (parsedTo && !Number.isNaN(parsedTo.getTime())) range.$lte = parsedTo;
  const txRange = Object.keys(range).length > 0 ? range : null;
  const topAgentsLimit = Math.min(20, Math.max(1, Number(options?.topAgentsLimit) || 5));
  const topBuyersLimit = Math.min(20, Math.max(1, Number(options?.topBuyersLimit) || 7));
  const topTransportersLimit = Math.min(20, Math.max(1, Number(options?.topTransportersLimit) || 5));
  const now = parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : new Date();
  const currentPeriodStart = parsedFrom && !Number.isNaN(parsedFrom.getTime())
    ? parsedFrom
    : new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  const periodDurationMs = Math.max(24 * 60 * 60 * 1000, now.getTime() - currentPeriodStart.getTime());
  const previousPeriodEnd = new Date(currentPeriodStart.getTime());
  const previousPeriodStart = new Date(currentPeriodStart.getTime() - periodDurationMs);

  const totalUsers = await User.countDocuments();
  const buyers = await User.countDocuments({ roles: 'buyer' });
  const agents = await User.countDocuments({ roles: 'agent' });
  const transporters = await User.countDocuments({ roles: 'transporter' });
  const admins = await User.countDocuments({ roles: 'admin' });
  const activeUsers = await User.countDocuments({ status: 'active' });
  const suspendedUsers = await User.countDocuments({ status: 'suspended' });
  const [usersCurrentPeriod, usersPreviousPeriod, activeAccountsCurrentPeriod, activeAccountsPreviousPeriod, activeAccounts7Days] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: currentPeriodStart, $lte: now } }),
    User.countDocuments({ createdAt: { $gte: previousPeriodStart, $lt: previousPeriodEnd } }),
    User.countDocuments({ updatedAt: { $gte: currentPeriodStart, $lte: now } }),
    User.countDocuments({ updatedAt: { $gte: previousPeriodStart, $lt: previousPeriodEnd } }),
    User.countDocuments({ updatedAt: { $gte: new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)), $lte: now } })
  ]);

  const totalOrders = await Order.countDocuments();
  const pendingOrders = await Order.countDocuments({ status: 'pending' });
  const paymentPendingOrders = await Order.countDocuments({ status: 'payment_pending' });
  const paidOrders = await Order.countDocuments({ status: 'paid' });
  const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
  const [ordersCurrentPeriod, ordersPreviousPeriod] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: currentPeriodStart, $lte: now } }),
    Order.countDocuments({ createdAt: { $gte: previousPeriodStart, $lt: previousPeriodEnd } })
  ]);

  const transactionQuery: Record<string, unknown> = { status: 'approved' };
  if (txRange) transactionQuery.createdAt = txRange;
  const allTransactions = await Transaction.find(transactionQuery);
  const totalRevenue = allTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const revenueCurrentPeriod = allTransactions
    .filter((t) => t.createdAt >= currentPeriodStart && t.createdAt <= now)
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const revenuePreviousPeriod = allTransactions
    .filter((t) => t.createdAt >= previousPeriodStart && t.createdAt < previousPeriodEnd)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentTransactions = await Transaction.find({
    status: 'approved',
    createdAt: { $gte: thirtyDaysAgo }
  });
  const last30DaysRevenue = recentTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const transactionsCount = allTransactions.length;

  // Simple revenue chart last 6 months
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
    { $limit: topBuyersLimit }
  ]);

  const topBuyersData = await Promise.all(
    buyerOrders.map(async (b) => {
      const buyerUser = await User.findById(b._id);
      return {
        id: b._id?.toString(),
        userId: b._id?.toString(),
        name: buyerUser?.name || buyerUser?.businessName || 'Unknown',
        email: buyerUser?.email || '',
        image: buyerUser?.image || null,
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
        totalSales: { $sum: '$totalAmount' },
        orders: { $addToSet: '$_id' }
      }
    },
    { $sort: { totalSales: -1 } },
    { $limit: topAgentsLimit }
  ]);

  const topAgentsData = await Promise.all(
    agentSales.map(async (a) => {
      const agentUser = await User.findById(a._id);
      const farmerData = agentFarmers.find((f) => f._id?.toString() === a._id?.toString());
      const productData = agentProducts.find((p) => p._id?.toString() === a._id?.toString());
      return {
        id: a._id?.toString(),
        userId: a._id?.toString(),
        name: agentUser?.name || agentUser?.businessName || 'Unknown',
        image: agentUser?.image || null,
        location: agentUser?.state || agentUser?.address || null,
        farmersOnboarded: farmerData?.farmersOnboarded || 0,
        productsListed: productData?.productsListed || 0,
        totalSales: a.totalSales,
        revenue: a.totalSales,
        orders: Array.isArray(a.orders) ? a.orders.length : 0
      };
    })
  );
  const transporterPayments = await FleetPayment.aggregate([
    { $match: { transporter: { $ne: null }, status: 'approved' } },
    {
      $group: {
        _id: '$transporter',
        bookings: { $sum: 1 },
        revenue: { $sum: '$amount' }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: topTransportersLimit }
  ]);
  const fallbackTransporterShipments = await ShippingRequest.aggregate([
    { $match: { transporter: { $ne: null } } },
    {
      $group: {
        _id: '$transporter',
        totalShipments: { $sum: 1 },
        totalRevenue: { $sum: '$negotiationPrice' }
      }
    }
  ]);
  const fallbackMap = new Map(fallbackTransporterShipments.map((item: any) => [item._id?.toString(), item]));

  const topTransportersData = await Promise.all(
    transporterPayments.map(async (t) => {
      const transporterUser = await User.findById(t._id);
      const fallback = fallbackMap.get(t._id?.toString?.());
      return {
        id: t._id?.toString(),
        userId: t._id?.toString(),
        name: transporterUser?.name || transporterUser?.businessName || 'Unknown',
        image: transporterUser?.image || null,
        location: transporterUser?.state || transporterUser?.address || null,
        totalShipments: fallback?.totalShipments || t.bookings || 0,
        totalRevenue: t.revenue || fallback?.totalRevenue || 0,
        revenue: t.revenue || fallback?.totalRevenue || 0,
        bookings: t.bookings || fallback?.totalShipments || 0
      };
    })
  );

  return {
    overview: {
      users: {
        value: totalUsers,
        deltaPercent: computeDeltaPercent(usersCurrentPeriod, usersPreviousPeriod)
      },
      payments: {
        value: totalRevenue,
        deltaPercent: computeDeltaPercent(revenueCurrentPeriod, revenuePreviousPeriod)
      },
      orders: {
        value: totalOrders,
        deltaPercent: computeDeltaPercent(ordersCurrentPeriod, ordersPreviousPeriod)
      },
      visitors: {
        value: activeAccountsCurrentPeriod,
        deltaPercent: computeDeltaPercent(activeAccountsCurrentPeriod, activeAccountsPreviousPeriod),
        metricSource: 'user_activity_proxy'
      }
    },
    userStats: {
      totalUsers,
      buyers,
      agents,
      transporters,
      admins,
      activeUsers,
      suspendedUsers,
      newUsersCurrentPeriod: usersCurrentPeriod,
      newUsersPreviousPeriod: usersPreviousPeriod,
      activeAccountsCurrentPeriod,
      activeAccountsPreviousPeriod,
      activeAccounts7Days
    },
    orderStats: {
      totalOrders,
      pending: pendingOrders,
      paymentPending: paymentPendingOrders,
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
