import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Bid from '@/models/bid';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/buyers/biddings - list buyer bids
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can view bids' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;
  const status = searchParams.get('status');

  const query: Record<string, unknown> = { buyer: user._id };
  if (status && ['pending', 'accepted', 'rejected', 'countered'].includes(status)) {
    query.status = status;
  }

  const [bids, total] = await Promise.all([
    Bid.find(query)
      .populate('product')
      .populate({
        path: 'agent',
        select: '_id name email phone businessName address country state lga activeRole roles'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Bid.countDocuments(query)
  ]);

  return NextResponse.json({
    success: true,
    data: bids,
    bids,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  }, { status: 200 });
}
