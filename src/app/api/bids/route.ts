import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Bid from '@/models/bid';
import Product from '@/models/product';
import User from '@/models/user';
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
  if (!user || !user.roles.includes('buyer')) {
    return NextResponse.json({ error: 'Only buyers can place bids' }, { status: 403 });
  }

  const { productId, amount, message } = await request.json();
  if (!productId || !amount) {
    return NextResponse.json({ error: 'Product and amount required' }, { status: 400 });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Find agent who owns the product
  const agent = await User.findById(product.owner);

  const bid = await Bid.create({
    product: product._id,
    buyer: user._id,
    agent: agent ? agent._id : undefined,
    amount,
    message,
    status: 'pending'
  });

  // Notify product owner/agent about new bid
  if (agent) {
    await createNotification({
      userId: agent._id.toString(),
      type: 'bid_created',
      title: 'New bid received',
      message: `You received a new bid of ${amount} on ${product.name}`,
      metadata: {
        productId: product._id.toString(),
        bidId: bid._id.toString(),
        amount,
        buyerName: user.name || user.email
      }
    });
  }

  return NextResponse.json({ bid }, { status: 201 });
}

export async function GET(request: Request) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const user = await User.findById(userData.userId);
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const skip = (page - 1) * limit;

  // If agent, get all bids for their products
  if (user && user.roles.includes('agent')) {
    const [bids, total] = await Promise.all([
      Bid.find({ agent: user._id }).populate('product buyer').skip(skip).limit(limit),
      Bid.countDocuments({ agent: user._id })
    ]);
    return NextResponse.json({
      success: true,
      data: bids,
      pagination: { page, limit, total }
    }, { status: 200 });
  }

  // If buyer, get their own bids
  const [bids, total] = await Promise.all([
    Bid.find({ buyer: user._id }).populate('product agent').skip(skip).limit(limit),
    Bid.countDocuments({ buyer: user._id })
  ]);
  return NextResponse.json({
    success: true,
    data: bids,
    pagination: { page, limit, total }
  }, { status: 200 });
}
