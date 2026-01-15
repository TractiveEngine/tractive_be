import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SupportTicket from '@/models/supportTicket';
import { requireAdmin } from '@/lib/apiAdmin';

export async function GET(request: Request) {
  const { error, user } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  const tickets = await SupportTicket.find()
    .populate('user', 'name email')
    .populate('linkedOrder')
    .populate('linkedTransaction')
    .sort({ createdAt: -1 });

  return NextResponse.json({ success: true, data: tickets }, { status: 200 });
}
