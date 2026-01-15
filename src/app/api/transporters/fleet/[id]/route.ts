import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
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
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const truck = await Truck.findOneAndUpdate(
    { _id: id, transporter: user._id },
    { ...body, updatedAt: new Date() },
    { new: true }
  );
  if (!truck) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: truck }, { status: 200 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const deleted = await Truck.findOneAndDelete({ _id: id, transporter: user._id });
  if (!deleted) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: 'Truck removed' }, { status: 200 });
}
