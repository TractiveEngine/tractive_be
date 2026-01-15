import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

// POST /api/reviews/:id/like - buyer like
export async function POST(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Buyer access required' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid review id' }, { status: 400 });
  }

  const review = await Review.findById(id);
  if (!review) {
    return NextResponse.json({ success: false, message: 'Review not found' }, { status: 404 });
  }

  const likerId = user._id.toString();
  const likes = (review.likes || []).map((l) => l.toString());
  if (!likes.includes(likerId)) {
    review.likes = [...(review.likes || []), user._id];
    await review.save();
  }

  return NextResponse.json({ success: true, data: { likesCount: review.likes?.length || 0 } }, { status: 200 });
}
