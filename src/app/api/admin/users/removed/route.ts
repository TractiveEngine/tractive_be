import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAdmin';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  await dbConnect();
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find({ status: 'removed' }).skip(skip).limit(limit),
    User.countDocuments({ status: 'removed' })
  ]);

  return NextResponse.json({
    success: true,
    data: users,
    pagination: { page, limit, total }
  }, { status: 200 });
}
