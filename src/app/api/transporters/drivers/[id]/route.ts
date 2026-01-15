import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Driver from '@/models/driver';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid driver id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const driver = await Driver.findOneAndUpdate(
    { _id: id, transporter: user._id },
    { ...body, updatedAt: new Date() },
    { new: true }
  );
  if (!driver) {
    return NextResponse.json({ success: false, message: 'Driver not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: driver }, { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid driver id' }, { status: 400 });
  }

  const deleted = await Driver.findOneAndDelete({ _id: id, transporter: user._id });
  if (!deleted) {
    return NextResponse.json({ success: false, message: 'Driver not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: 'Driver removed' }, { status: 200 });
}
