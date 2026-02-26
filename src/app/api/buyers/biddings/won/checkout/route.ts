import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Bid from '@/models/bid';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

async function getCheckoutSummary(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can proceed to checkout' }, { status: 403 });
  }

  const bids = await Bid.find({ buyer: user._id, status: 'accepted' })
    .populate('product')
    .populate({
      path: 'agent',
      select: '_id name email phone businessName address country state lga activeRole roles'
    });
  const totalAmount = bids.reduce((sum, b) => sum + (b.amount || 0), 0);

  return NextResponse.json({ success: true, data: { bids, totalAmount } }, { status: 200 });
}

// GET /api/buyers/biddings/won/checkout - summary of accepted bids for checkout
export async function GET(request: Request) {
  return getCheckoutSummary(request);
}

// POST /api/buyers/biddings/won/checkout - alias for frontend compatibility
export async function POST(request: Request) {
  return getCheckoutSummary(request);
}
