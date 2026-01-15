import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import { getAuthUser } from '@/lib/apiAuth';
import mongoose from 'mongoose';

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
