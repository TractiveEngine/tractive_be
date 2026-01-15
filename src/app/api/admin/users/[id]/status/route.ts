import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status;
  if (!['active', 'suspended'].includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }

  const user = await User.findByIdAndUpdate(id, { status }, { new: true });
  if (!user) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: user, message: 'User status updated' }, { status: 200 });
}
