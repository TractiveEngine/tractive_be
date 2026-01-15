import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import { createNotification } from '@/lib/notifications';
import mongoose from 'mongoose';

const ORDER_STATUS = ['pending', 'paid', 'delivered'] as const;
const TRANSPORT_STATUS = ['pending', 'picked', 'on_transit', 'delivered'] as const;

type OrderStatus = (typeof ORDER_STATUS)[number];
type TransportStatus = (typeof TRANSPORT_STATUS)[number];

function isOrderStatus(value: any): value is OrderStatus {
  return ORDER_STATUS.includes(value);
}

function isTransportStatus(value: any): value is TransportStatus {
  return TRANSPORT_STATUS.includes(value);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await Order.findById(id).populate('products.product');
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  // Determine role-based ownership/permissions
  const isBuyer = ensureActiveRole(user, 'buyer') && order.buyer?.toString() === user._id.toString();
  const sellerIds = (order.products || [])
    .map((p: any) => p?.product?.owner?.toString?.())
    .filter(Boolean);
  const isSeller = ensureActiveRole(user, 'agent') && sellerIds.includes(user._id.toString());
  const isTransporter = ensureActiveRole(user, 'transporter') && order.transporter?.toString() === user._id.toString();
  const isAdmin = ensureActiveRole(user, 'admin');

  if (!isBuyer && !isSeller && !isTransporter && !isAdmin) {
    return NextResponse.json({ success: false, message: 'Not authorized to update this order' }, { status: 403 });
  }

  const body: any = await request.json().catch(() => ({}));
  const { status, transportStatus, transporter } = body;

  if (status && !isOrderStatus(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }
  if (transportStatus && !isTransportStatus(transportStatus)) {
    return NextResponse.json({ success: false, message: 'Invalid transport status' }, { status: 400 });
  }

  // Buyer limitations: can only update their own order and limited statuses; cannot assign transporter
  if (isBuyer) {
    if (transporter || transportStatus) {
      return NextResponse.json(
        { success: false, message: 'Buyers cannot change transport assignments' },
        { status: 403 }
      );
    }
    if (status && !['pending', 'paid'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Buyers cannot set this status' },
        { status: 403 }
      );
    }
  }

  // Transporter can only adjust transportStatus on assigned orders
  if (isTransporter && (status || transporter)) {
    return NextResponse.json(
      { success: false, message: 'Transporters may only update transport status' },
      { status: 403 }
    );
  }

  // Apply updates
  const prevStatus = order.status;
  const prevTransport = order.transportStatus;

  if (status) order.status = status;
  if (transportStatus) order.transportStatus = transportStatus;
  if (transporter && (isAdmin || isSeller)) {
    if (!mongoose.Types.ObjectId.isValid(transporter)) {
      return NextResponse.json({ success: false, message: 'Invalid transporter id' }, { status: 400 });
    }
    order.transporter = transporter;
  }

  order.updatedAt = new Date();
  await order.save();

  // Notify buyer on changes
  if (status && status !== prevStatus) {
    await createNotification({
      userId: order.buyer.toString(),
      type: 'order_status_changed',
      title: 'Order status updated',
      message: `Order status changed from ${prevStatus} to ${status}`,
      metadata: { orderId: order._id.toString(), oldStatus: prevStatus, newStatus: status },
    });
  }
  if (transportStatus && transportStatus !== prevTransport) {
    await createNotification({
      userId: order.buyer.toString(),
      type: 'order_transport_status_changed',
      title: 'Transport status updated',
      message: `Transport status changed to ${transportStatus}`,
      metadata: { orderId: order._id.toString(), transportStatus },
    });
  }

  return NextResponse.json({ success: true, data: order }, { status: 200 });
}
