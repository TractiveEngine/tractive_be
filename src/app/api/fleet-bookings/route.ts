import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import FleetBooking from '@/models/fleetBooking';
import '@/models/truck';
import '@/models/fleetBid';
import '@/models/fleetPayment';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (status && ['pending_payment', 'confirmed', 'rejected', 'cancelled', 'completed'].includes(status)) {
    query.status = status;
  }

  if (ensureActiveRole(user, 'buyer')) {
    query.buyer = user._id;
  } else if (ensureActiveRole(user, 'transporter')) {
    query.transporter = user._id;
  } else if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json(
      { success: false, message: 'Buyer, transporter, or admin access required' },
      { status: 403 }
    );
  }

  const [bookings, total] = await Promise.all([
    FleetBooking.find(query)
      .populate('fleet', '_id plateNumber fleetName fleetNumber model price status route')
      .populate('buyer', '_id name email phone')
      .populate('transporter', '_id name email phone businessName')
      .populate('fleetBid', '_id amount counterAmount status')
      .populate('payment', '_id amount paymentMethod status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    FleetBooking.countDocuments(query)
  ]);

  return NextResponse.json({
    success: true,
    data: bookings,
    pagination: { page, limit, total }
  }, { status: 200 });
}
