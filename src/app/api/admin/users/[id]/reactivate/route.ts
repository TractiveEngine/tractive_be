import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiAdmin';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import mongoose from 'mongoose';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  await dbConnect();
  const { id } = await Promise.resolve(params);
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

  return NextResponse.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name || user.businessName || 'Unknown',
      email: user.email,
      roles: user.roles,
      activeRole: user.activeRole,
      status: user.status,
      agentApprovalStatus: user.agentApprovalStatus ?? null,
      transporterApprovalStatus: user.transporterApprovalStatus ?? null,
      updatedAt: user.updatedAt
    },
    message: 'User reactivated'
  }, { status: 200 });
}
