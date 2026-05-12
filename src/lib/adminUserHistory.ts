import User from '@/models/user';
import Order from '@/models/order';
import Product from '@/models/product';
import Transaction from '@/models/transaction';
import FleetPayment from '@/models/fleetPayment';
import FleetTrip from '@/models/fleetTrip';

export type AdminHistoryRole = 'buyer' | 'agent' | 'transporter';
export type AdminHistoryResource =
  | 'orders'
  | 'transactions'
  | 'transport-payments'
  | 'sales'
  | 'products'
  | 'payments'
  | 'trips';

export function buildDateRange(searchParams: URLSearchParams) {
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  if (!fromDate && !toDate) return null;
  const createdAt: Record<string, Date> = {};
  if (fromDate) createdAt.$gte = new Date(fromDate);
  if (toDate) createdAt.$lte = new Date(toDate);
  return createdAt;
}

export function buildPagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export async function getAdminUserHistory({
  userId,
  role,
  resource,
  searchParams
}: {
  userId: string;
  role: AdminHistoryRole;
  resource: AdminHistoryResource;
  searchParams: URLSearchParams;
}) {
  const target = await User.findById(userId).select('_id roles');
  if (!target) {
    return { status: 404, body: { success: false, message: 'User not found' } };
  }

  const { page, limit, skip } = buildPagination(searchParams);
  const createdAt = buildDateRange(searchParams);
  const status = searchParams.get('status');
  const transportStatus = searchParams.get('transportStatus');

  const baseOrderQuery = createdAt ? { createdAt } : {};
  const basePaymentQuery = createdAt ? { createdAt } : {};
  const baseTripQuery = createdAt ? { createdAt } : {};

  if (role === 'buyer') {
    if (!target.roles.includes('buyer')) {
      return { status: 400, body: { success: false, message: 'User does not have buyer role' } };
    }

    if (resource === 'orders') {
      const query: any = { buyer: target._id, ...baseOrderQuery };
      if (status) query.status = status;
      if (transportStatus) query.transportStatus = transportStatus;
      const [items, total] = await Promise.all([
        Order.find(query)
          .populate('products.product', 'name images owner')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Order.countDocuments(query)
      ]);
      return { status: 200, body: { success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
    }

    if (resource === 'transactions') {
      const query: any = { buyer: target._id, ...basePaymentQuery };
      if (status) query.status = status;
      const [items, total] = await Promise.all([
        Transaction.find(query)
          .populate('order', 'totalAmount status transportStatus createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Transaction.countDocuments(query)
      ]);
      return { status: 200, body: { success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
    }

    if (resource === 'transport-payments') {
      const query: any = { buyer: target._id, ...basePaymentQuery };
      if (status) query.status = status;
      const [items, total] = await Promise.all([
        FleetPayment.find(query)
          .populate('fleet', 'plateNumber fleetName model')
          .populate('transporter', 'name businessName email phone')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        FleetPayment.countDocuments(query)
      ]);
      return { status: 200, body: { success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
    }
  }

  if (role === 'agent') {
    if (!target.roles.includes('agent')) {
      return { status: 400, body: { success: false, message: 'User does not have agent role' } };
    }

    const ownedProductIds = await Product.find({ owner: target._id }).distinct('_id');

    if (resource === 'products') {
      const query: any = { owner: target._id };
      if (status) query.status = status;
      const [items, total] = await Promise.all([
        Product.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(query)
      ]);
      return { status: 200, body: { success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
    }

    if (resource === 'sales') {
      const query: any = { 'products.product': { $in: ownedProductIds }, ...baseOrderQuery };
      if (status) query.status = status;
      if (transportStatus) query.transportStatus = transportStatus;
      const [orders, total] = await Promise.all([
        Order.find(query)
          .populate('buyer', 'name email businessName phone')
          .populate('products.product', 'name owner unit images')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Order.countDocuments(query)
      ]);

      const ownedIdSet = new Set(ownedProductIds.map((productId: any) => productId.toString()));
      const items = orders.flatMap((order: any) =>
        (order.products || [])
          .filter((line: any) => ownedIdSet.has(line?.product?._id?.toString?.() || line?.product?.toString?.()))
          .map((line: any) => ({
            orderId: order._id,
            buyer: order.buyer,
            product: line.product,
            quantity: line.quantity,
            unit: line.unit || null,
            unitPrice: line.unitPrice ?? null,
            lineSubtotal: line.lineSubtotal ?? null,
            orderStatus: order.status,
            transportStatus: order.transportStatus,
            createdAt: order.createdAt
          }))
      );

      return { status: 200, body: { success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
    }
  }

  if (role === 'transporter') {
    if (!target.roles.includes('transporter')) {
      return { status: 400, body: { success: false, message: 'User does not have transporter role' } };
    }

    if (resource === 'orders') {
      const query: any = { transporter: target._id, ...baseOrderQuery };
      if (status) query.status = status;
      if (transportStatus) query.transportStatus = transportStatus;
      const [items, total] = await Promise.all([
        Order.find(query)
          .populate('buyer', 'name email businessName phone')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Order.countDocuments(query)
      ]);
      return { status: 200, body: { success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
    }

    if (resource === 'payments') {
      const query: any = { transporter: target._id, ...basePaymentQuery };
      if (status) query.status = status;
      const [items, total] = await Promise.all([
        FleetPayment.find(query)
          .populate('buyer', 'name email businessName phone')
          .populate('fleet', 'plateNumber fleetName model')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        FleetPayment.countDocuments(query)
      ]);
      return { status: 200, body: { success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
    }

    if (resource === 'trips') {
      const query: any = { transporter: target._id, ...baseTripQuery };
      if (status) query.status = status;
      const [items, total] = await Promise.all([
        FleetTrip.find(query)
          .populate('fleet', 'plateNumber fleetName model')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        FleetTrip.countDocuments(query)
      ]);
      return { status: 200, body: { success: true, data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } };
    }
  }

  return { status: 400, body: { success: false, message: 'Unsupported history role/resource' } };
}
