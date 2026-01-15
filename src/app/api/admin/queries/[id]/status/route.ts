import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SupportTicket from '@/models/supportTicket';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid ticket id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status;
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }

  const ticket = await SupportTicket.findByIdAndUpdate(
    id,
    { status, updatedAt: new Date() },
    { new: true }
  );
  if (!ticket) {
    return NextResponse.json({ success: false, message: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: ticket }, { status: 200 });
}
