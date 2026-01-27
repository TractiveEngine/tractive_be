import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import Bid from '@/models/bid';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

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

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid product id' }, { status: 400 });
  }

  const product = await Product.findById(id);
  if (!product) {
    return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
  }

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  const isOwner = product.owner?.toString() === user._id.toString();
  const isAdmin = user.activeRole === 'admin';
  const isBuyer = user.activeRole === 'buyer';
  if (!isOwner && !isAdmin && !isBuyer) {
    return NextResponse.json({ success: false, message: 'Not authorized to view bids for this product' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');
  const statusParam = searchParams.get('status');
  const sortOrderParam = (searchParams.get('sortOrder') || 'desc').toLowerCase();
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = { product: product._id };
  if (statusParam) {
    query.status = statusParam;
  }
  if (isBuyer) {
    query.buyer = user._id;
  }

  const sortDirection = sortOrderParam === 'asc' ? 1 : -1;

  const [bids, total, leadingAmountDoc] = await Promise.all([
    Bid.find(query)
      .sort({ amount: -1, createdAt: sortDirection })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'buyer', select: '_id name email' }),
    Bid.countDocuments(query),
    Bid.findOne({ product: product._id }).sort({ amount: -1, createdAt: 1 }).select('amount')
  ]);

  const leadingAmount = leadingAmountDoc?.amount;
  const data = bids.map((bid) => {
    const obj = bid.toObject();
    return {
      ...obj,
      isLeading: leadingAmount !== undefined ? obj.amount === leadingAmount : false
    };
  });

  return NextResponse.json({
    success: true,
    data,
    meta: {
      leadingAmount: leadingAmount ?? null
    },
    pagination: { page, limit, total }
  }, { status: 200 });
}
