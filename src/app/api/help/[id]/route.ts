import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SupportTicket from '@/models/supportTicket';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

// DELETE /api/help/:id
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid ticket id' }, { status: 400 });
  }

  const ticket = await SupportTicket.findById(id);
  if (!ticket) {
    return NextResponse.json({ success: false, message: 'Ticket not found' }, { status: 404 });
  }

  const isAdmin = ensureActiveRole(user, 'admin');
  if (!isAdmin && ticket.user.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized to close this ticket' }, { status: 403 });
  }

  if (ticket.status === 'resolved' && !isAdmin) {
    return NextResponse.json({ success: false, message: 'Resolved tickets cannot be closed by users' }, { status: 400 });
  }

  ticket.status = 'closed';
  await ticket.save();

  return NextResponse.json({
    success: true,
    data: ticket,
    message: 'Ticket closed successfully'
  }, { status: 200 });
}
