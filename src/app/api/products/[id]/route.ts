import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import User from '@/models/user';
import '@/models/farmer';
import Review from '@/models/review';
import Bid from '@/models/bid';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// Shape of the JWT you issue (adjust if you use `sub` instead of `userId`)
type JwtUserPayload = JwtPayload & {
  userId: string;
  email?: string;
  role?: string;
};

function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string') return null;

    // If you use `sub` in your tokens, uncomment the 3 lines below:
    // const idFromSub = typeof decoded.sub === 'string' ? decoded.sub : undefined;
    // const uid = (decoded as JwtUserPayload).userId ?? idFromSub;
    // if (!uid) return null;

    if (typeof (decoded as JwtUserPayload).userId !== 'string') return null; // guard
    return decoded as JwtUserPayload;
  } catch {
    return null;
  }
}

// GET /api/products/[id]
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const productDoc = await Product.findById(id)
    .populate({
      path: 'owner',
      select: '_id name email phone businessName address country state lga activeRole roles'
    })
    .populate({
      path: 'farmer',
      select: '_id name phone businessName address country state lga villageOrLocalMarket approvalStatus'
    });
  if (!productDoc) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const ownerId = (productDoc.owner as any)?._id ?? productDoc.owner;
  const [reviewStats, recentReviews, leadingBidDoc, bidsCount] = await Promise.all([
    Review.aggregate([
      { $match: { agent: ownerId } },
      {
        $group: {
          _id: '$agent',
          count: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      }
    ]),
    Review.find({ agent: ownerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({ path: 'buyer', select: '_id name email' })
      .select('_id rating comment reply likes createdAt buyer'),
    Bid.findOne({ product: productDoc._id })
      .sort({ amount: -1, createdAt: 1 })
      .populate({ path: 'buyer', select: '_id name email' })
      .select('_id amount status createdAt buyer'),
    Bid.countDocuments({ product: productDoc._id })
  ]);

  const stats = reviewStats[0];
  const reviewSummary = {
    count: stats?.count ?? 0,
    averageRating: stats?.averageRating ?? 0
  };

  const bidSummary = {
    count: bidsCount,
    leadingBid: leadingBidDoc
      ? {
          _id: leadingBidDoc._id,
          amount: leadingBidDoc.amount,
          status: leadingBidDoc.status,
          createdAt: leadingBidDoc.createdAt,
          buyer: leadingBidDoc.buyer
        }
      : null
  };

  const product = {
    ...productDoc.toObject(),
    reviewSummary,
    recentReviews,
    bidSummary
  };
  return NextResponse.json({ product }, { status: 200 });
}

// PATCH /api/products/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.some((r: string) => ['admin', 'agent'].includes(r))) {
    return NextResponse.json({ error: 'Only admin or agent can update products' }, { status: 403 });
  }

  const body = await request.json();
  const isStringArray = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');
  const hasDataUri = (items: string[]) => items.some((item) => item.trim().toLowerCase().startsWith('data:'));

  if (body.images !== undefined) {
    if (!isStringArray(body.images)) {
      return NextResponse.json({ error: 'Images must be an array of URL strings' }, { status: 400 });
    }
    if (hasDataUri(body.images)) {
      return NextResponse.json({ error: 'Images must be URL links, not base64 data' }, { status: 400 });
    }
  }

  if (body.videos !== undefined) {
    if (!isStringArray(body.videos)) {
      return NextResponse.json({ error: 'Videos must be an array of URL strings' }, { status: 400 });
    }
    if (hasDataUri(body.videos)) {
      return NextResponse.json({ error: 'Videos must be URL links, not base64 data' }, { status: 400 });
    }
  }
  const product = await Product.findByIdAndUpdate(id, body, { new: true });
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ product }, { status: 200 });
}

// PUT /api/products/[id]
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return PATCH(request, { params });
}

// DELETE /api/products/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.some((r: string) => ['admin', 'agent'].includes(r))) {
    return NextResponse.json({ error: 'Only admin or agent can delete products' }, { status: 403 });
  }

  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Product deleted successfully' }, { status: 200 });
}

