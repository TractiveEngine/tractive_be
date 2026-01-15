import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Bid from '@/models/bid';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/buyers/biddings/won/checkout - summary of accepted bids for checkout
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can proceed to checkout' }, { status: 403 });
  }

  const bids = await Bid.find({ buyer: user._id, status: 'accepted' }).populate('product agent');
  const totalAmount = bids.reduce((sum, b) => sum + (b.amount || 0), 0);

  return NextResponse.json({ success: true, data: { bids, totalAmount } }, { status: 200 });
}
