import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Bid from '@/models/bid';
import Order from '@/models/order';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/buyers/biddings/won - accepted bids for buyer
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can view won bids' }, { status: 403 });
  }

  const paidOrders = await Order.find({
    buyer: user._id,
    status: { $in: ['paid', 'delivered'] },
    bidIds: { $exists: true, $ne: [] }
  }).select('bidIds');

  const consumedBidIds = paidOrders.flatMap((order: any) =>
    (order.bidIds || []).map((id: any) => id.toString())
  );

  const bidQuery: Record<string, unknown> = { buyer: user._id, status: 'accepted' };
  if (consumedBidIds.length > 0) {
    bidQuery._id = { $nin: consumedBidIds };
  }

  const bids = await Bid.find(bidQuery)
    .populate('product')
    .populate({
      path: 'agent',
      select: '_id name email phone businessName address country state lga activeRole roles'
    });
  return NextResponse.json({ success: true, data: bids }, { status: 200 });
}
