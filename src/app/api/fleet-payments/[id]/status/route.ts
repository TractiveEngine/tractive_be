import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import FleetPayment from '@/models/fleetPayment';

const ALLOWED_STATUS = ['approved', 'rejected', 'pending'] as const;

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

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet payment id' }, { status: 400 });
  }

  const payment = await FleetPayment.findById(id);
  if (!payment) {
    return NextResponse.json({ success: false, message: 'Fleet payment not found' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status;
  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }

  payment.status = status;
  payment.approvedBy = user._id;
  payment.updatedAt = new Date();
  await payment.save();

  return NextResponse.json({ success: true, data: payment }, { status: 200 });
}
