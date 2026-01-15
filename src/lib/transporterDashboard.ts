import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import Transaction from '@/models/transaction';
import Truck from '@/models/truck';
import Driver from '@/models/driver';

type RevenuePoint = { label: string; amount: number };

export async function getTransporterDashboardData(transporterId: string) {
  await dbConnect();

  const orders = await Order.find({ transporter: transporterId });
  const orderIds = orders.map((order) => order._id);

  const transactions = await Transaction.find({
    order: { $in: orderIds }
  });

  const totalRevenue = transactions
    .filter((t) => t.status === 'approved')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const activeOrders = orders.filter(
    (order) => order.status !== 'delivered' && order.transportStatus !== 'delivered'
  ).length;
  const completedOrders = orders.filter(
    (order) => order.status === 'delivered' || order.transportStatus === 'delivered'
  ).length;

  const trucks = await Truck.find({ transporter: transporterId });
  const drivers = await Driver.find({ transporter: transporterId });

  const fleetStatus = {
    available: trucks.filter((t) => !t.assignedDriver).length,
    on_transit: trucks.filter((t) => t.assignedDriver).length,
    under_maintenance: 0
  };

  const uniqueBuyerIds = new Set(orders.map((order) => order.buyer?.toString()).filter(Boolean));
  const customersServed = uniqueBuyerIds.size;

  const topCustomers = Array.from(uniqueBuyerIds).map((id) => {
    const buyerOrders = orders.filter((o) => o.buyer?.toString() === id);
    const total = buyerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { buyerId: id, orders: buyerOrders.length, totalAmount: total };
  }).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10);

  const topFleet = trucks
    .map((t) => ({
      truckId: t._id.toString(),
      plateNumber: t.plateNumber,
      onTransit: Boolean(t.assignedDriver)
    }))
    .slice(0, 10);

  const trucksOnTransit = trucks.filter((t) => t.assignedDriver);

  // Simple revenue chart: last 6 months approved revenue grouped by month number
  const now = new Date();
  const revenueChart: RevenuePoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const amount = transactions
      .filter(
        (t) =>
          t.status === 'approved' &&
          t.createdAt >= month &&
          t.createdAt < nextMonth
      )
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    revenueChart.push({
      label: `${month.getFullYear()}-${month.getMonth() + 1}`,
      amount
    });
  }

  return {
    totalRevenue,
    activeOrders,
    completedOrders,
    totalFleet: trucks.length,
    fleetStatus,
    customersServed,
    driversCount: drivers.length,
    topCustomers,
    topFleet,
    revenueChart,
    trucksOnTransit
  };
}
