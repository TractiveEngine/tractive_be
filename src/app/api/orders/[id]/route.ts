import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import jwt from 'jsonwebtoken';
import { createNotification } from '@/lib/notifications';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return typeof p === 'object' && p !== null && 'userId' in p && typeof (p as JwtUserPayload).userId === 'string';
}

function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || !isJwtUserPayload(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const order = await Order.findById(id).populate('products.product');
  if (!order || String(order.buyer) !== userData.userId) {
    return NextResponse.json({ error: 'Order not found or access denied' }, { status: 404 });
  }
  return NextResponse.json({ order }, { status: 200 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const order = await Order.findById(id);
  if (!order || String(order.buyer) !== userData.userId) {
    return NextResponse.json({ error: 'Order not found or access denied' }, { status: 404 });
  }

  const body = await request.json();
  // Only allow valid status and transportStatus values
  if (body.status && !['pending', 'paid', 'delivered'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (body.transportStatus && !['pending', 'picked', 'on_transit', 'delivered'].includes(body.transportStatus)) {
    return NextResponse.json({ error: 'Invalid transport status' }, { status: 400 });
  }

  const oldStatus = order.status;
  const oldTransportStatus = order.transportStatus;
  
  Object.assign(order, body, { updatedAt: new Date() });
  await order.save();

  // Notify buyer about order status change
  if (body.status && body.status !== oldStatus) {
    await createNotification({
      userId: order.buyer.toString(),
      type: 'order_status_changed',
      title: 'Order status updated',
      message: `Your order status changed from ${oldStatus} to ${body.status}`,
      metadata: {
        orderId: order._id.toString(),
        oldStatus,
        newStatus: body.status,
        totalAmount: order.totalAmount
      }
    });
  }

  // Notify about transport status change
  if (body.transportStatus && body.transportStatus !== oldTransportStatus) {
    await createNotification({
      userId: order.buyer.toString(),
      type: 'order_status_changed',
      title: 'Delivery status updated',
      message: `Your delivery status changed to ${body.transportStatus}`,
      metadata: {
        orderId: order._id.toString(),
        transportStatus: body.transportStatus
      }
    });
  }

  return NextResponse.json({ order }, { status: 200 });
}

