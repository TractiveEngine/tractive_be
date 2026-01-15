import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import User from '@/models/user';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/transporters/recommendations
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const top = await Review.aggregate([
    { $group: { _id: '$agent', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    { $sort: { avgRating: -1, count: -1 } },
    { $limit: 10 }
  ]);

  const transporterIds = top.map((t) => t._id);
  const transporters = await User.find({ _id: { $in: transporterIds } })
    .select('_id name email phone businessName activeRole roles status')
    .lean();

  const scoreMap = new Map(top.map((t) => [t._id.toString(), t]));
  const data = transporters
    .map((t) => ({
      ...t,
      avgRating: scoreMap.get(t._id.toString())?.avgRating || 0,
      reviewsCount: scoreMap.get(t._id.toString())?.count || 0
    }))
    .sort((a, b) => (b.avgRating as number) - (a.avgRating as number));

  return NextResponse.json({ success: true, data }, { status: 200 });
}
