import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

const STATUS = ['available', 'on_transit', 'under_maintenance'] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const resolvedParams = await Promise.resolve(params);
  const { id } = resolvedParams;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid fleet id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status || body?.fleetStates;
  if (!STATUS.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }

  const truck = await Truck.findById(id);
  if (!truck) {
    return NextResponse.json({ success: false, message: 'Truck not found' }, { status: 404 });
  }
  if (truck.transporter?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized for this truck' }, { status: 403 });
  }

  truck.status = status;
  truck.updatedAt = new Date();
  await truck.save();

  return NextResponse.json({ success: true, data: truck }, { status: 200 });
}
