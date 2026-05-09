import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

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
    return NextResponse.json({ success: false, message: 'Invalid transporter id' }, { status: 400 });
  }

  const { status, reason } = await request.json().catch(() => ({}));
  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ success: false, message: 'Status must be either approved or rejected' }, { status: 400 });
  }

  const transporter = await User.findById(id);
  if (!transporter || !transporter.roles.includes('transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter not found' }, { status: 404 });
  }

  transporter.transporterApprovalStatus = status;
  if (reason) {
    transporter.approvalNotes = reason;
  }
  await transporter.save();

  return NextResponse.json({
    success: true,
    data: {
      _id: transporter._id,
      name: transporter.name || transporter.businessName,
      email: transporter.email,
      transporterApprovalStatus: transporter.transporterApprovalStatus,
      approvalNotes: transporter.approvalNotes
    },
    message: `Transporter ${status} successfully`
  }, { status: 200 });
}
