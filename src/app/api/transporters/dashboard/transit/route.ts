import { NextResponse } from 'next/server';
import FleetTrip from '@/models/fleetTrip';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 10));
  const tripStatus = status === 'in_progress' ? ['loaded', 'on_transit', 'arrived', 'planned'] : [status || 'on_transit'];
  const trips = await FleetTrip.find({
    transporter: user._id,
    status: { $in: tripStatus }
  })
    .populate('fleet', '_id plateNumber fleetName iot model images')
    .populate('buyerIds', '_id name businessName image state')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({ success: true, data: trips }, { status: 200 });
}
