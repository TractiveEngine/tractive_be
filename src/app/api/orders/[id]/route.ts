import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import User from '@/models/user';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: any): p is JwtUserPayload {
  return p && typeof p === 'object' && typeof p.userId === 'string';
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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const order = await Order.findById(params.id).populate('products.product');
  if (!order || String(order.buyer) !== userData.userId) {
    return NextResponse.json({ error: 'Order not found or access denied' }, { status: 404 });
  }
  return NextResponse.json({ order }, { status: 200 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const order = await Order.findById(params.id);
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

  Object.assign(order, body, { updatedAt: new Date() });
  await order.save();

  return NextResponse.json({ order }, { status: 200 });
}
