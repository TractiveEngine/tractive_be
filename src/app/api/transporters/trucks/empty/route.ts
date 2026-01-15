import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/transporters/trucks/empty
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromState = searchParams.get('fromState');
  const toState = searchParams.get('toState');

  const query: any = { status: 'available' };
  if (fromState) query['route.fromState'] = fromState;
  if (toState) query['route.toState'] = toState;

  const trucks = await Truck.find(query).sort({ createdAt: -1 });
  return NextResponse.json({ success: true, data: trucks }, { status: 200 });
}
