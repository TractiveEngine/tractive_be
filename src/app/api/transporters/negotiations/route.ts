import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import NegotiationOffer from '@/models/negotiation';
import { listFleetBids } from '@/lib/fleetBidDto';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  const fleetBidQuery: Record<string, unknown> = {
    transporter: user._id,
    status: status || { $in: ['pending', 'countered'] }
  };

  if (year || month) {
    const createdAt: Record<string, Date> = {};
    const parsedYear = year ? Number(year) : undefined;
    const parsedMonth = month ? Number(month) : undefined;
    if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
      createdAt.$gte = new Date(parsedYear, parsedMonth - 1, 1);
      createdAt.$lt = new Date(parsedYear, parsedMonth, 1);
    } else if (parsedYear) {
      createdAt.$gte = new Date(parsedYear, 0, 1);
      createdAt.$lt = new Date(parsedYear + 1, 0, 1);
    }
    if (Object.keys(createdAt).length > 0) {
      fleetBidQuery.createdAt = createdAt;
    }
  }

  const fleetBidsResult = await listFleetBids(fleetBidQuery, page, limit);
  if (fleetBidsResult.data.length > 0) {
    return NextResponse.json({
      success: true,
      data: fleetBidsResult.data.map((bid: any) => ({
        ...bid,
        source: 'fleet_bid',
        negotiationStatus: bid.status
      })),
      pagination: fleetBidsResult.pagination
    }, { status: 200 });
  }

  const legacyQuery: Record<string, unknown> = { transporter: user._id };
  if (status) {
    legacyQuery.negotiationStatus = status;
  }
  if (fleetBidQuery.createdAt) {
    legacyQuery.createdAt = fleetBidQuery.createdAt;
  }

  const skip = (page - 1) * limit;
  const [negotiations, total] = await Promise.all([
    NegotiationOffer.find(legacyQuery)
      .populate('shippingRequest')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    NegotiationOffer.countDocuments(legacyQuery)
  ]);

  return NextResponse.json({
    success: true,
    data: negotiations.map((negotiation: any) => ({
      ...(typeof negotiation.toObject === 'function' ? negotiation.toObject() : negotiation),
      source: 'legacy_negotiation'
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }, { status: 200 });
}
