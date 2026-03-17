import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import '@/models/farmer';
import Review from '@/models/review';
import Bid from '@/models/bid';
import { attachWishlistedFlag, buildCategoryFields } from '@/lib/productPayload';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/products/[id]
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const authUser = await getAuthUser(_request);
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

  const populatedOwner = productDoc.owner as { _id?: string } | string | null;
  const ownerId = typeof populatedOwner === 'object' && populatedOwner !== null && '_id' in populatedOwner
    ? populatedOwner._id
    : populatedOwner;
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

  const [productWithWishlist] = await attachWishlistedFlag([
    {
      ...productDoc.toObject(),
      reviewSummary,
      recentReviews,
      bidSummary
    }
  ], authUser ? { userId: authUser._id.toString() } : null);

  const product = {
    ...productWithWishlist,
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

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin') && !ensureActiveRole(user, 'agent')) {
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
  const categoryFields = buildCategoryFields(body);
  const product = await Product.findByIdAndUpdate(id, { ...body, ...categoryFields }, { new: true });
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

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin') && !ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ error: 'Only admin or agent can delete products' }, { status: 403 });
  }

  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Product deleted successfully' }, { status: 200 });
}

