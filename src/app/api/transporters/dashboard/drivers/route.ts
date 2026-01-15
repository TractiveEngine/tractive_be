import { NextResponse } from 'next/server';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import { getTransporterDashboardData } from '@/lib/transporterDashboard';
import Driver from '@/models/driver';
import dbConnect from '@/lib/dbConnect';

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  await dbConnect();
  const drivers = await Driver.find({ transporter: user._id });
  const dashboard = await getTransporterDashboardData(user._id.toString());

  return NextResponse.json(
    { success: true, data: { driversCount: dashboard.driversCount, drivers } },
    { status: 200 }
  );
}
