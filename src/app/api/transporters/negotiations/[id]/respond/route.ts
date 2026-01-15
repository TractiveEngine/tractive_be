import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import NegotiationOffer from '@/models/negotiation';
import ShippingRequest from '@/models/shipping';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid negotiation id' }, { status: 400 });
  }

  const negotiation = await NegotiationOffer.findById(id);
  if (!negotiation || negotiation.transporter.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Negotiation not found' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  const action = body?.action;
  if (!['accept', 'reject', 'counter'].includes(action)) {
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  }

  if (action === 'accept') {
    negotiation.negotiationStatus = 'accepted';
    // Link transporter to shipping request and mark status
    await ShippingRequest.findByIdAndUpdate(negotiation.shippingRequest, {
      transporter: user._id,
      status: 'accepted',
      updatedAt: new Date(),
    });
  } else if (action === 'reject') {
    negotiation.negotiationStatus = 'rejected';
    await ShippingRequest.findByIdAndUpdate(negotiation.shippingRequest, {
      status: 'rejected',
      updatedAt: new Date(),
    });
  } else if (action === 'counter') {
    const amount = body?.amount;
    if (!amount || typeof amount !== 'number') {
      return NextResponse.json({ success: false, message: 'Counter offer requires amount' }, { status: 400 });
    }
    negotiation.amount = amount;
    negotiation.negotiationStatus = 'pending';
  }

  negotiation.updatedAt = new Date();
  await negotiation.save();

  return NextResponse.json({ success: true, data: negotiation }, { status: 200 });
}
