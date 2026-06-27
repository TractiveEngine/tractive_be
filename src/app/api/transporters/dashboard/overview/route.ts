import { NextResponse } from 'next/server';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { getTransporterOverview } from '@/lib/transporterPortal';

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const overview = await getTransporterOverview(user._id.toString());
  return NextResponse.json({
    success: true,
    data: {
      revenue: overview.revenue,
      bookings: overview.bookings,
      drivers: overview.drivers,
      fleets: overview.fleets,
      deltas: overview.deltas
    }
  }, { status: 200 });
}

