import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import FleetPayment from '@/models/fleetPayment';
import { requireAdmin } from '@/lib/apiAdmin';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }
    if (method) {
      query.paymentMethod = method;
    }
    if (fromDate || toDate) {
      const createdAt: Record<string, Date> = {};
      if (fromDate) createdAt.$gte = new Date(fromDate);
      if (toDate) createdAt.$lte = new Date(toDate);
      query.createdAt = createdAt;
    }

    const [payments, total] = await Promise.all([
      FleetPayment.find(query)
        .populate('buyer', 'name email phone businessName')
        .populate('transporter', 'name email phone businessName')
        .populate('fleet', '_id plateNumber fleetName fleetNumber model route status price')
        .populate('fleetBid', '_id amount counterAmount status')
        .populate('booking', '_id status amount')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FleetPayment.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        fleetPayments: payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching fleet payments:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
