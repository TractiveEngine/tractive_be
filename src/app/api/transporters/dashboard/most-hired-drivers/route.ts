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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit')) || 5));
  const overview = await getTransporterOverview(user._id.toString());
  return NextResponse.json({
    success: true,
    data: overview.mostHiredDrivers.slice(0, limit)
  }, { status: 200 });
}

