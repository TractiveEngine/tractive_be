import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Farmer from '@/models/farmer';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

// PATCH /api/admin/approvals/farmers/:id - Approve or reject farmer
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid farmer id' }, { status: 400 });
  }

  const { status, reason } = await request.json().catch(() => ({}));
  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ success: false, message: 'Status must be either approved or rejected' }, { status: 400 });
  }

  const farmer = await Farmer.findById(id);
  if (!farmer) {
    return NextResponse.json({ success: false, message: 'Farmer not found' }, { status: 404 });
  }

  farmer.approvalStatus = status;
  if (reason) {
    farmer.approvalNotes = reason;
  }
  farmer.approvedBy = user._id;
  farmer.approvedAt = new Date();
  await farmer.save();

  return NextResponse.json({
    success: true,
    data: {
      _id: farmer._id,
      name: farmer.name,
      approvalStatus: farmer.approvalStatus,
      approvalNotes: farmer.approvalNotes,
      approvedBy: user.name || user.email,
      approvedAt: farmer.approvedAt
    },
    message: `Farmer ${status} successfully`
  }, { status: 200 });
}
