import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import Review from '@/models/review';
import Order from '@/models/order';

// GET /api/transporters - list transporters (buyer/admin)
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const state = searchParams.get('state');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  const query: Record<string, unknown> = { roles: 'transporter', status: { $ne: 'removed' } };
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [{ name: regex }, { businessName: regex }, { email: regex }];
  }
  if (state) {
    query.state = state;
  }
  if (year || month) {
    const createdAt: Record<string, Date> = {};
    const parsedYear = year ? Number(year) : undefined;
    const parsedMonth = month ? Number(month) : undefined;
    if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
      createdAt.$gte = new Date(parsedYear, parsedMonth - 1, 1);
      createdAt.$lt = new Date(parsedYear, parsedMonth, 1);
    } else if (parsedYear) {
      createdAt.$gte = new Date(parsedYear, 0, 1);
      createdAt.$lt = new Date(parsedYear + 1, 0, 1);
    }
    if (Object.keys(createdAt).length > 0) {
      query.createdAt = createdAt;
    }
  }

  const transporters = await User.find(query)
    .select('_id name email phone businessName activeRole roles status image bio address country state createdAt')
    .sort({ createdAt: -1 });

  const transporterIds = transporters.map((item) => item._id);
  const [reviewStats, deliveryStats] = await Promise.all([
    Review.aggregate([
      { $match: { agent: { $in: transporterIds } } },
      {
        $group: {
          _id: '$agent',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]),
    Order.aggregate([
      { $match: { transporter: { $in: transporterIds }, status: 'delivered' } },
      {
        $group: {
          _id: '$transporter',
          totalSales: { $sum: '$totalAmount' },
          deliveriesCount: { $sum: 1 }
        }
      }
    ])
  ]);

  const reviewMap = new Map(reviewStats.map((item) => [item._id.toString(), item]));
  const deliveryMap = new Map(deliveryStats.map((item) => [item._id.toString(), item]));

  const data = transporters.map((transporter) => {
    const transporterId = transporter._id.toString();
    const review = reviewMap.get(transporterId);
    const delivery = deliveryMap.get(transporterId);
    return {
      ...transporter.toObject(),
      rating: review?.averageRating ?? 0,
      reviewsCount: review?.totalReviews ?? 0,
      totalSales: delivery?.totalSales ?? 0,
      deliveriesCount: delivery?.deliveriesCount ?? 0,
      location: transporter.state || transporter.address || null,
    };
  });

  return NextResponse.json({ success: true, data }, { status: 200 });
}

// POST /api/transporters - create/update transporter profile (transporter/admin)
export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const body: any = await request.json().catch(() => ({}));
  const isTransporter = ensureActiveRole(user, 'transporter');
  const isAdmin = ensureActiveRole(user, 'admin');
  if (!isTransporter && !isAdmin) {
    return NextResponse.json({ success: false, message: 'Transporter or admin access required' }, { status: 403 });
  }

  const targetId = isAdmin && body?.userId ? body.userId : user._id.toString();

  const target = await User.findById(targetId);
  if (!target) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  if (!isAdmin && target._id.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  // Ensure transporter role
  if (!target.roles.includes('transporter')) {
    target.roles.push('transporter');
  }
  if (!target.activeRole) {
    target.activeRole = 'transporter';
  }

  const fields = ['name', 'phone', 'businessName', 'address', 'country', 'state'] as const;
  for (const key of fields) {
    if (body[key] !== undefined) {
      (target as any)[key] = body[key];
    }
  }

  await target.save();

  return NextResponse.json({ success: true, data: target, message: 'Transporter profile saved' }, { status: 201 });
}
