import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SupportTicket from '@/models/supportTicket';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid ticket id' }, { status: 400 });
  }

  const deleted = await SupportTicket.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json({ success: false, message: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Ticket deleted' }, { status: 200 });
}
