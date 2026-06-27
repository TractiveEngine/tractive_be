import dbConnect from '@/lib/dbConnect';
import Farmer from '@/models/farmer';
import FleetTrip from '@/models/fleetTrip';
import Order from '@/models/order';
import Product from '@/models/product';
import Transaction from '@/models/transaction';
import User from '@/models/user';
import {
  buildFleetSummaryForOrder,
  buildOrderOwnerSummary,
  buildTrackingSummaryFromEvents,
  buildTransporterStatsMap,
  buildTransporterSummaryForOrder,
  buildTripTimelineMap,
  computeEstimatedDeliveryDate
} from '@/lib/orderView';

export function buildRange(from?: string | null, to?: string | null) {
  const createdAt: Record<string, Date> = {};
  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) createdAt.$gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) createdAt.$lte = toDate;
  }
  return Object.keys(createdAt).length > 0 ? createdAt : null;
}

export async function getAgentDashboardData(agentId: string, options?: {
  from?: string | null;
  to?: string | null;
}) {
  await dbConnect();
  const productIds = await Product.find({ owner: agentId }).distinct('_id');
  const dateRange = buildRange(options?.from || null, options?.to || null);

  if (productIds.length === 0) {
    return {
      overview: {
        revenue: 0,
        orders: 0,
        customers: 0,
        products: 0,
        deltas: { revenue: 0, orders: 0, customers: 0, products: 0 }
      },
      revenueSeries: [],
      topCustomers: [],
      mostSoldItems: [],
      mostSoldCategories: [],
      outOfStock: []
    };
  }

  const orderQuery: Record<string, unknown> = { 'products.product': { $in: productIds } };
  const productQuery: Record<string, unknown> = { _id: { $in: productIds } };
  if (dateRange) {
    orderQuery.createdAt = dateRange;
    productQuery.createdAt = dateRange;
  }

  const [orders, products, farmers] = await Promise.all([
    Order.find(orderQuery)
      .populate('buyer', '_id name businessName image')
      .populate('products.product', '_id name images category subcategory owner')
      .sort({ createdAt: -1 })
      .lean(),
    Product.find(productQuery).sort({ createdAt: -1 }).lean(),
    Farmer.find({ createdBy: agentId }).lean()
  ]);

  const agentOrderIds = new Set(orders.map((order: any) => order._id.toString()));
  const transactions = await Transaction.find({
    order: { $in: Array.from(agentOrderIds) },
    status: 'approved'
  }).lean();

  const revenue = transactions.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
  const uniqueCustomers = new Set(orders.map((order: any) => order.buyer?._id?.toString?.() || order.buyer?.toString?.()).filter(Boolean));

  const mostSoldItemsMap = new Map<string, any>();
  const categoryMap = new Map<string, { category: string; value: number }>();
  const customerMap = new Map<string, any>();

  for (const order of orders as any[]) {
    const buyerId = order.buyer?._id?.toString?.() || order.buyer?.toString?.() || null;
    if (buyerId) {
      const existing = customerMap.get(buyerId) || {
        id: buyerId,
        name: order.buyer?.name || order.buyer?.businessName || 'Unknown',
        image: order.buyer?.image || null,
        ordersCount: 0,
        revenue: 0
      };
      existing.ordersCount += 1;
      existing.revenue += Number(order.totalAmount || 0);
      customerMap.set(buyerId, existing);
    }

    for (const item of order.products || []) {
      const product = item.product && typeof item.product === 'object' ? item.product : null;
      if (!product || product.owner?.toString?.() !== agentId) continue;
      const id = product._id.toString();
      const quantitySold = Number(item.quantity || 0);
      const existingItem = mostSoldItemsMap.get(id) || {
        productId: id,
        name: product.name || 'Unknown product',
        image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null,
        quantitySold: 0,
        revenue: 0
      };
      existingItem.quantitySold += quantitySold;
      existingItem.revenue += Number(item.lineSubtotal || order.totalAmount || 0);
      mostSoldItemsMap.set(id, existingItem);

      const categoryKey = product.category || product.subcategory || 'Uncategorized';
      const categoryExisting = categoryMap.get(categoryKey) || {
        category: categoryKey,
        value: 0
      };
      categoryExisting.value += quantitySold;
      categoryMap.set(categoryKey, categoryExisting);
    }
  }

  const now = new Date();
  const revenueSeries: Array<{ date: string; value: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const value = transactions
      .filter((tx: any) => tx.createdAt >= month && tx.createdAt < nextMonth)
      .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
    revenueSeries.push({
      date: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      value
    });
  }

  const categoryTotal = Array.from(categoryMap.values()).reduce((sum, item) => sum + item.value, 0);

  return {
    overview: {
      revenue,
      orders: orders.length,
      customers: uniqueCustomers.size,
      products: products.length,
      farmers: farmers.length,
      deltas: { revenue: 0, orders: 0, customers: 0, products: 0 }
    },
    revenueSeries,
    topCustomers: Array.from(customerMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
    mostSoldItems: Array.from(mostSoldItemsMap.values())
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10),
    mostSoldCategories: Array.from(categoryMap.values())
      .sort((a, b) => b.value - a.value)
      .map((item) => ({
        ...item,
        percentage: categoryTotal > 0 ? Math.round((item.value / categoryTotal) * 100) : 0
      })),
    outOfStock: products
      .filter((product: any) => product.status === 'out_of_stock' || Number(product.quantity || 0) <= 0)
      .slice(0, 10)
      .map((product: any) => ({
        productId: product._id.toString(),
        name: product.name,
        image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null,
        quantity: Number(product.quantity || 0),
        status: product.status
      }))
  };
}

export async function getAgentOrderView(agentId: string, orderId: string) {
  await dbConnect();
  const order = await Order.findById(orderId)
    .populate('buyer', '_id name businessName email phone image address state')
    .populate({
      path: 'products.product',
      populate: { path: 'owner', select: '_id name businessName image' }
    })
    .lean();
  if (!order) return null;

  const ownedProducts = (order.products || []).filter((item: any) =>
    item?.product?.owner?._id?.toString?.() === agentId || item?.product?.owner?.toString?.() === agentId
  );
  if (ownedProducts.length === 0) return null;

  const tripId = order.fleetTripId?.toString?.() || null;
  const trip = tripId
    ? await FleetTrip.findById(tripId)
        .populate('fleet', '_id plateNumber fleetName iot tracker model images route estimatedDeliveryValue estimatedDeliveryUnit')
        .populate('transporter', '_id name businessName phone image address state createdAt')
        .lean()
    : null;
  const timelineMap = tripId ? await buildTripTimelineMap([tripId]) : new Map<string, any[]>();
  const transporterId = trip?.transporter?._id?.toString?.() || trip?.transporter?.toString?.() || null;
  const transporterStatsMap = await buildTransporterStatsMap(transporterId ? [transporterId] : []);
  const trackingSummary = buildTrackingSummaryFromEvents(
    tripId ? (timelineMap.get(tripId) || []) : [],
    { estDeliveryDate: computeEstimatedDeliveryDate(trip) }
  );

  return {
    ...order,
    products: (order.products || []).map((item: any) => ({
      ...item,
      product: item.product && typeof item.product === 'object'
        ? {
            ...item.product,
            owner: buildOrderOwnerSummary(item.product.owner)
          }
        : item.product
    })),
    buyer: order.buyer,
    transporter: buildTransporterSummaryForOrder(
      trip?.transporter && typeof trip.transporter === 'object' ? trip.transporter : null,
      transporterId ? transporterStatsMap.get(transporterId) : null
    ),
    fleet: buildFleetSummaryForOrder(trip?.fleet && typeof trip.fleet === 'object' ? trip.fleet : null),
    fromState: trip?.origin || (trip as any)?.fleet?.route?.fromState || null,
    toState: trip?.destination || (trip as any)?.fleet?.route?.toState || null,
    currentStep: order.transportStatus,
    iotId: (trip as any)?.fleet?.iot || (trip as any)?.fleet?.tracker || null,
    plateNumber: (trip as any)?.fleet?.plateNumber || null,
    mapMarkers: (tripId ? (timelineMap.get(tripId) || []) : []).map((event: any) => ({
      status: event.status,
      location: event.location || '',
      timestamp: event.createdAt || null,
      lat: event.latitude ?? null,
      lng: event.longitude ?? null
    })),
    ...trackingSummary
  };
}
