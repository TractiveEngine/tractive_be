import { NextResponse } from 'next/server';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { getTransporterOverview } from '@/lib/transporterPortal';

// GET /api/transporters/dashboard - Get transporter dashboard metrics
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
      totalRevenue: overview.revenue,
      activeOrders: overview.transit.length,
      completedOrders: Math.max(0, overview.bookings - overview.transit.length),
      totalFleet: overview.fleets,
      fleetStatus: {
        available: Math.max(0, overview.fleets - overview.transit.length),
        on_transit: overview.transit.length,
        under_maintenance: 0
      },
      customersServed: overview.topCustomers.length,
      revenue: overview.revenue,
      bookings: overview.bookings,
      drivers: overview.drivers,
      fleets: overview.fleets,
      deltas: overview.deltas
    }
  }, { status: 200 });
}
