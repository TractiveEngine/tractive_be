import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SupportTicket from '@/models/supportTicket';
import { requireAdmin } from '@/lib/apiAdmin';
import mongoose from 'mongoose';
import { createNotification } from '@/lib/notifications';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { error, user } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid ticket id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const reply = body?.reply;
  if (!reply) {
    return NextResponse.json({ success: false, message: 'Reply is required' }, { status: 400 });
  }

  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    return NextResponse.json({ success: false, message: 'Ticket not found' }, { status: 404 });
  }

  ticket.adminNotes = [ticket.adminNotes, reply].filter(Boolean).join('\n');
  ticket.status = ticket.status === 'open' ? 'in_progress' : ticket.status;
  ticket.updatedAt = new Date();
  await ticket.save();

  await createNotification({
    userId: ticket.user.toString(),
    type: 'support_ticket_updated',
    title: 'Support ticket replied',
    message: reply,
    metadata: { ticketId: ticket._id.toString() },
  });

  return NextResponse.json({ success: true, data: ticket }, { status: 200 });
}
