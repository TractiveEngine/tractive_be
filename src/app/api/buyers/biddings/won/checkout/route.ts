import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import { getEligibleWonBidsForBuyer } from '@/lib/buyerWonBids';

async function getCheckoutSummary(request: Request) {
  try {
    await dbConnect();

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }
    if (!ensureActiveRole(user, 'buyer')) {
      return NextResponse.json({ success: false, message: 'Only buyers can proceed to checkout' }, { status: 403 });
    }

    const bids = await getEligibleWonBidsForBuyer(user._id.toString());
    const productsSubtotal = bids.reduce((sum, b: any) => sum + (b.amount || 0), 0);
    const localTransportTotal = bids.reduce((sum, b: any) => {
      const fee = Number(b?.product?.localTransport?.fee || 0);
      const required = !!b?.product?.localTransport?.required;
      return sum + (required && !Number.isNaN(fee) ? fee : 0);
    }, 0);
    const totalAmount = productsSubtotal + localTransportTotal;

    return NextResponse.json({
      success: true,
      data: {
        bids,
        productsSubtotal,
        localTransportTotal,
        totalAmount
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Buyer checkout summary fetch failed:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to load checkout summary at the moment' },
      { status: 500 }
    );
  }
}

// GET /api/buyers/biddings/won/checkout - summary of accepted bids for checkout
export async function GET(request: Request) {
  return getCheckoutSummary(request);
}

// POST /api/buyers/biddings/won/checkout - alias for frontend compatibility
export async function POST(request: Request) {
  return getCheckoutSummary(request);
}
