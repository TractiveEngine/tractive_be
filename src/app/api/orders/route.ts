import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import User from '@/models/user';
import Product from '@/models/product';
import Bid from '@/models/bid';
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

  const { products, totalAmount, address, transportStatus, bidIds } = await request.json();
  if (!products || !Array.isArray(products) || products.length === 0 || !totalAmount) {
    return NextResponse.json({ error: 'Products and totalAmount required' }, { status: 400 });
  }

  const idempotencyKey = request.headers.get('Idempotency-Key') || request.headers.get('idempotency-key');
  if (idempotencyKey) {
    const existingByKey = await Order.findOne({ buyer: user._id, idempotencyKey });
    if (existingByKey) {
      return NextResponse.json({
        success: true,
        data: existingByKey,
        message: 'Existing order returned for idempotency key'
      }, { status: 200 });
    }
  }

  const normalizeProducts = products
    .map((item: any) => ({
      product: item.product?.toString?.() ?? String(item.product),
      quantity: Number(item.quantity)
    }))
    .sort((a: any, b: any) => (a.product > b.product ? 1 : -1));
  const normalizedBidIds = Array.isArray(bidIds)
    ? bidIds.map((id: any) => String(id)).sort()
    : [];
  const orderSignature = JSON.stringify({ products: normalizeProducts, bidIds: normalizedBidIds });

  const existingPending = await Order.findOne({
    buyer: user._id,
    status: 'pending',
    orderSignature
  });
  if (existingPending) {
    return NextResponse.json({
      success: true,
      data: existingPending,
      message: 'Existing pending order returned'
    }, { status: 200 });
  }

  if (Array.isArray(bidIds) && bidIds.length > 0) {
    const bids = await Bid.find({ _id: { $in: bidIds }, buyer: user._id });
    const missing = bidIds.filter((id: string) => !bids.some((b) => b._id.toString() === id));
    if (missing.length > 0) {
      return NextResponse.json({ error: 'One or more bids not found for buyer' }, { status: 400 });
    }
    const invalidStatus = bids.find((bid) => bid.status !== 'accepted');
    if (invalidStatus) {
      return NextResponse.json({ error: 'All bids must be accepted before creating an order' }, { status: 400 });
    }
    const expectedTotal = bids.reduce((sum, bid) => sum + (bid.amount || 0), 0);
    if (Number(totalAmount) !== expectedTotal) {
      return NextResponse.json({ error: 'Total amount does not match accepted bids' }, { status: 400 });
    }
  }

  const order = await Order.create({
    buyer: user._id,
    products,
    totalAmount,
    address,
    status: 'pending',
    transportStatus: transportStatus || 'pending',
    idempotencyKey: idempotencyKey || undefined,
    orderSignature
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
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({ buyer: userData.userId }).populate('products.product').skip(skip).limit(limit),
    Order.countDocuments({ buyer: userData.userId })
  ]);

  return NextResponse.json({
    success: true,
    data: orders,
    pagination: { page, limit, total }
  }, { status: 200 });
}
