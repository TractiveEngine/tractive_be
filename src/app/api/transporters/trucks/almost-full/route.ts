import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Truck from '@/models/truck';
import { getAuthUser } from '@/lib/apiAuth';
import { buildCapacityMeta } from '@/lib/truckCapacity';

// GET /api/transporters/trucks/almost-full
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const fromState = searchParams.get('fromState');
  const toState = searchParams.get('toState');

  const query: any = { status: 'on_transit' };
  if (fromState) query['route.fromState'] = fromState;
  if (toState) query['route.toState'] = toState;
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [
      { plateNumber: regex },
      { fleetName: regex },
      { fleetNumber: regex },
      { model: regex },
      { iot: regex },
      { size: regex },
      { capacity: regex }
    ];
  }

  const trucks = await Truck.find(query).sort({ createdAt: -1 });
  return NextResponse.json({
    success: true,
    data: trucks.map((truck) => {
      const truckObj = truck.toObject();
      return { ...truckObj, ...buildCapacityMeta(truckObj) };
    })
  }, { status: 200 });
}
