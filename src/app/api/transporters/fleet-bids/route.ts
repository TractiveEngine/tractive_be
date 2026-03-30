import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { listFleetBids } from '@/lib/fleetBidDto';
import Truck from '@/models/truck';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const fleetId = searchParams.get('fleetId');
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));

  const query: Record<string, unknown> = { transporter: user._id };
  if (status) {
    query.status = status;
  }
  if (fleetId) {
    if (!mongoose.Types.ObjectId.isValid(fleetId)) {
      return NextResponse.json({ success: false, message: 'Invalid fleetId' }, { status: 400 });
    }
    const fleet = await Truck.findOne({ _id: fleetId, transporter: user._id }).select('_id');
    if (!fleet) {
      return NextResponse.json({ success: false, message: 'Fleet not found' }, { status: 404 });
    }
    query.fleet = fleet._id;
  }

  const result = await listFleetBids(query, page, limit);
  return NextResponse.json({ success: true, data: result.data, pagination: result.pagination }, { status: 200 });
}
