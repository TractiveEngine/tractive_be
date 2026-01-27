import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Bid from '@/models/bid';
import Product from '@/models/product';
import User from '@/models/user';
import '@/models/farmer';
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

  const body = await request.json();
  const productId = body.productId || body.product;
  const amount = body.amount ?? body.proposedPrice;
  const message = body.message;
  if (!productId || amount === undefined || amount === null) {
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
  const groupByProductParam = (searchParams.get('groupByProduct') || '').toLowerCase();
  const groupByProduct = groupByProductParam === 'true' || groupByProductParam === '1';
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const skip = (page - 1) * limit;

  const activeRole = user?.activeRole;

  // If agent, get all bids for their products
  if (activeRole === 'agent') {
    const baseQuery = { agent: user._id };
    const [bids, total] = await Promise.all([
      Bid.find(baseQuery)
        .populate({
          path: 'product',
          populate: { path: 'farmer', select: '_id name businessName' }
        })
        .populate({ path: 'buyer', select: '_id name email' })
        .sort({ createdAt: -1 }),
      Bid.countDocuments(baseQuery)
    ]);

    if (groupByProduct) {
      const groupedMap = new Map<string, any>();

      for (const bid of bids) {
        const bidObj = bid.toObject();
        const product = bidObj.product;
        const productId = product?._id?.toString?.() ?? String(product);
        if (!groupedMap.has(productId)) {
          const farmerName =
            product?.farmer?.name ||
            product?.farmer?.businessName ||
            null;
          groupedMap.set(productId, {
            product,
            farmerName,
            bidsCount: 0,
            leadingBid: null,
            bidders: []
          });
        }

        const entry = groupedMap.get(productId);
        entry.bidsCount += 1;
        entry.bidders.push({
          bidId: bidObj._id,
          amount: bidObj.amount,
          status: bidObj.status,
          createdAt: bidObj.createdAt,
          buyer: bidObj.buyer
        });

        if (!entry.leadingBid || bidObj.amount > entry.leadingBid.amount) {
          entry.leadingBid = {
            bidId: bidObj._id,
            amount: bidObj.amount,
            buyer: bidObj.buyer
          };
        }
      }

      const grouped = Array.from(groupedMap.values())
        .sort((a, b) => (b.leadingBid?.amount || 0) - (a.leadingBid?.amount || 0));

      const paged = grouped.slice(skip, skip + limit);

      return NextResponse.json({
        success: true,
        data: paged,
        pagination: { page, limit, total: grouped.length }
      }, { status: 200 });
    }

    const pagedBids = bids.slice(skip, skip + limit);
    return NextResponse.json({
      success: true,
      data: pagedBids,
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
