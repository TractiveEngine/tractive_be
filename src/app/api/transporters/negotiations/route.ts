import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import NegotiationOffer from '@/models/negotiation';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const negotiations = await NegotiationOffer.find({ transporter: user._id })
    .populate('shippingRequest')
    .sort({ createdAt: -1 });

  return NextResponse.json({ success: true, data: negotiations }, { status: 200 });
}
