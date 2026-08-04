import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import mongoose from 'mongoose';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import User from '@/models/user';

// GET /api/sellers/:id/reviews
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid seller id' }, { status: 400 });
  }

  const objectId = new mongoose.Types.ObjectId(id);
  const stats = await Review.aggregate([
    { $match: { agent: objectId } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    }
  ]);

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>;
  let totalReviews = 0;
  let weighted = 0;
  for (const row of stats) {
    const rating = Number(row._id);
    const count = Number(row.count) || 0;
    if (distribution[rating] !== undefined) distribution[rating] = count;
    totalReviews += count;
    weighted += rating * count;
  }
  const averageRating = totalReviews > 0 ? weighted / totalReviews : 0;

  return NextResponse.json({
    success: true,
    data: {
      averageRating,
      totalReviews,
      ratingDistribution: {
        '5_star': distribution[5],
        '4_star': distribution[4],
        '3_star': distribution[3],
        '2_star': distribution[2],
        '1_star': distribution[1]
      }
    }
  }, { status: 200 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const buyer = await getAuthUser(request);
  if (!buyer) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(buyer, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can post seller reviews' }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid seller id' }, { status: 400 });
  }

  const seller = await User.findById(id).select('_id roles');
  if (!seller || !seller.roles.includes('agent')) {
    return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
  }

  const { rating, comment } = await request.json().catch(() => ({}));
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, message: 'rating (1-5) required' }, { status: 400 });
  }

  const existingReview = await Review.findOne({ agent: seller._id, buyer: buyer._id });
  if (existingReview) {
    return NextResponse.json({ success: false, message: 'You have already reviewed this seller', hasReviewed: true, data: existingReview }, { status: 409 });
  }

  const review = await Review.create({
    agent: seller._id,
    buyer: buyer._id,
    rating,
    comment
  });

  return NextResponse.json({ success: true, data: review }, { status: 201 });
}
