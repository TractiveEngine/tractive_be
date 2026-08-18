import { NextResponse } from 'next/server';
import { GET as getFleetPaymentsForFleet, POST as createFleetPaymentForFleet } from '@/app/api/transporters/fleet/[id]/payments/route';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fleetId = searchParams.get('fleetId');
  if (!fleetId) {
    return NextResponse.json({ success: false, message: 'fleetId query parameter is required' }, { status: 400 });
  }

  return getFleetPaymentsForFleet(request, { params: Promise.resolve({ id: fleetId }) });
}

export async function POST(request: Request) {
  const cloned = request.clone();
  const body = await cloned.json().catch(() => ({}));
  const fleetId = body?.fleetId;
  if (!fleetId || typeof fleetId !== 'string') {
    return NextResponse.json({ success: false, message: 'fleetId is required in the request body' }, { status: 400 });
  }

  return createFleetPaymentForFleet(request, { params: Promise.resolve({ id: fleetId }) });
}
