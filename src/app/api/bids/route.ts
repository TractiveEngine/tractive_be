import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Bid from '@/models/bid';
import Product from '@/models/product';
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

  return NextResponse.json({ bid }, { status: 201 });
}

export async function GET(request: Request) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const user = await User.findById(userData.userId);

  // If agent, get all bids for their products
  if (user && user.roles.includes('agent')) {
    const bids = await Bid.find({ agent: user._id }).populate('product buyer');
    return NextResponse.json({ bids }, { status: 200 });
  }

  // If buyer, get their own bids
  const bids = await Bid.find({ buyer: user._id }).populate('product agent');
  return NextResponse.json({ bids }, { status: 200 });
}
