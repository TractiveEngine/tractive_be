import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import User from '@/models/user';

// GET /api/transporters/:id/reviews
export async function GET(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transporter id' }, { status: 400 });
  }

  const reviews = await Review.find({ agent: id }).populate('buyer', 'name email');
  return NextResponse.json({ success: true, data: reviews }, { status: 200 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const buyer = await getAuthUser(request);
  if (!buyer) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(buyer, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can post transporter reviews' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transporter id' }, { status: 400 });
  }

  const transporter = await User.findById(id).select('_id roles');
  if (!transporter || !transporter.roles.includes('transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter not found' }, { status: 404 });
  }

  const { rating, comment } = await request.json().catch(() => ({}));
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, message: 'rating (1-5) required' }, { status: 400 });
  }

  const existingReview = await Review.findOne({ agent: transporter._id, buyer: buyer._id });
  if (existingReview) {
    return NextResponse.json({ success: false, message: 'You have already reviewed this transporter', hasReviewed: true, data: existingReview }, { status: 409 });
  }

  const review = await Review.create({
    agent: transporter._id,
    buyer: buyer._id,
    rating,
    comment
  });

  return NextResponse.json({ success: true, data: review }, { status: 201 });
}
