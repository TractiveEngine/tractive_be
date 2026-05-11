import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/apiAdmin';

export async function POST(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const body: any = await request.json().catch(() => ({}));
  const userIds = Array.isArray(body?.userIds) ? body.userIds : [];

  if (userIds.length === 0) {
    return NextResponse.json({ success: false, message: 'userIds is required' }, { status: 400 });
  }
  if (!userIds.every((id: string) => mongoose.Types.ObjectId.isValid(id))) {
    return NextResponse.json({ success: false, message: 'One or more user IDs are invalid' }, { status: 400 });
  }

  const result = await User.updateMany(
    { _id: { $in: userIds } },
    { $set: { status: 'active', updatedAt: new Date() } }
  );

  return NextResponse.json({
    success: true,
    data: {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      status: 'active'
    },
    message: `${result.modifiedCount} users reactivated`
  }, { status: 200 });
}
