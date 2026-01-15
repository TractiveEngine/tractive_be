import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAdmin';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import mongoose from 'mongoose';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  await dbConnect();
  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid user id' }, { status: 400 });
  }

  const user = await User.findByIdAndUpdate(
    id,
    { status: 'active' },
    { new: true }
  );

  if (!user) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: user, message: 'User reactivated' }, { status: 200 });
}
