import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAdmin';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  await dbConnect();
  const users = await User.find({ status: 'removed' });
  return NextResponse.json({ success: true, data: users }, { status: 200 });
}
