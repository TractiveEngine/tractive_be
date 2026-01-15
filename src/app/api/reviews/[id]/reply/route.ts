import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

// POST /api/reviews/:id/reply - agent reply
export async function POST(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ success: false, message: 'Agent access required' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid review id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const message = body?.message;
  if (!message) {
    return NextResponse.json({ success: false, message: 'Message is required' }, { status: 400 });
  }

  const review = await Review.findById(id);
  if (!review || review.agent.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Review not found' }, { status: 404 });
  }

  review.reply = { user: user._id, message, createdAt: new Date() };
  await review.save();

  return NextResponse.json({ success: true, data: review }, { status: 200 });
}
