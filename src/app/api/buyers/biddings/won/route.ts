import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import { getEligibleWonBidsForBuyer } from '@/lib/buyerWonBids';

// GET /api/buyers/biddings/won - accepted bids for buyer
export async function GET(request: Request) {
  try {
    await dbConnect();

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }
    if (!ensureActiveRole(user, 'buyer')) {
      return NextResponse.json({ success: false, message: 'Only buyers can view won bids' }, { status: 403 });
    }

    const bids = await getEligibleWonBidsForBuyer(user._id.toString());
    return NextResponse.json({ success: true, data: bids }, { status: 200 });
  } catch (error) {
    console.error('Buyer won bids fetch failed:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to fetch won bids at the moment' },
      { status: 500 }
    );
  }
}
