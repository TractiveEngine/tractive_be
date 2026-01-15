import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import User from '@/models/user';
import Product from '@/models/product';
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

export async function POST(request: Request) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const user = await User.findById(userData.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { products, totalAmount, address, transportStatus } = await request.json();
  if (!products || !Array.isArray(products) || products.length === 0 || !totalAmount) {
    return NextResponse.json({ error: 'Products and totalAmount required' }, { status: 400 });
  }

  const order = await Order.create({
    buyer: user._id,
    products,
    totalAmount,
    address,
    status: 'pending',
    transportStatus: transportStatus || 'pending'
  });

  // Notify buyer about order creation
  await createNotification({
    userId: user._id.toString(),
    type: 'order_created',
    title: 'Order created successfully',
    message: `Your order of ${totalAmount} has been created`,
    metadata: {
      orderId: order._id.toString(),
      totalAmount,
      productsCount: products.length
    }
  });

  // Notify sellers/agents about new order
  const productIds = products.map((p: any) => p.product);
  const productDocs = await Product.find({ _id: { $in: productIds } });
  const sellerIds = [...new Set(productDocs.map(p => p.owner.toString()))];
  
  for (const sellerId of sellerIds) {
    await createNotification({
      userId: sellerId,
      type: 'order_created',
      title: 'New order received',
      message: `You have a new order for ${totalAmount}`,
      metadata: {
        orderId: order._id.toString(),
        totalAmount,
        buyerName: user.name || user.email
      }
    });
  }

  return NextResponse.json({ order }, { status: 201 });
}

export async function GET(request: Request) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  // Get orders for the authenticated user
  const orders = await Order.find({ buyer: userData.userId }).populate('products.product');
  return NextResponse.json({ orders }, { status: 200 });
}
