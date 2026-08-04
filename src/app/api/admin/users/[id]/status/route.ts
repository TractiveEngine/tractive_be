import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';

const SAFE_USER_STATUS_FIELDS =
  '_id name email roles activeRole status businessName phone createdAt updatedAt isVerified agentApprovalStatus transporterApprovalStatus';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid user ID' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status;
  if (!['active', 'suspended'].includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }

  const user = await User.findByIdAndUpdate(id, { status }, { new: true })
    .select(SAFE_USER_STATUS_FIELDS)
    .lean();
  if (!user) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: user, message: 'User status updated' }, { status: 200 });
}
