import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import User from '@/models/user';
import Truck from '@/models/truck';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/transporters/recommendations
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedState = searchParams.get('state') || searchParams.get('location');
  const effectiveState = requestedState || user.state || null;

  const top = await Review.aggregate([
    { $group: { _id: '$agent', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    { $sort: { avgRating: -1, count: -1 } },
    { $limit: 30 }
  ]);

  const transporterIds = top.map((t) => t._id);
  const locationMatchedFleetIds = effectiveState
    ? await Truck.distinct('transporter', {
        $or: [
          { 'route.fromState': effectiveState },
          { 'route.toState': effectiveState }
        ]
      })
    : [];
  const transporters = await User.find({ _id: { $in: transporterIds } })
    .select('_id name email phone businessName activeRole roles status state address image')
    .lean();

  const scoreMap = new Map(top.map((t) => [t._id.toString(), t]));
  const locationMatchedSet = new Set(locationMatchedFleetIds.map((id: any) => id.toString()));
  const data = transporters
    .map((t) => ({
      ...t,
      avgRating: scoreMap.get(t._id.toString())?.avgRating || 0,
      reviewsCount: scoreMap.get(t._id.toString())?.count || 0,
      locationMatch: effectiveState
        ? t.state === effectiveState || locationMatchedSet.has(t._id.toString())
        : false,
      matchedLocation: effectiveState,
    }))
    .sort((a, b) => {
      if (a.locationMatch !== b.locationMatch) {
        return a.locationMatch ? -1 : 1;
      }
      return (b.avgRating as number) - (a.avgRating as number);
    })
    .slice(0, 10);

  return NextResponse.json({ success: true, data }, { status: 200 });
}
