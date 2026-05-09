import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/transporters/reviews
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const isAdmin = ensureActiveRole(user, 'admin');
  const isTransporter = ensureActiveRole(user, 'transporter');
  if (!isAdmin && !isTransporter) {
    return NextResponse.json({ success: false, message: 'Transporter or admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const transporterId = searchParams.get('transporterId');
  const effectiveTransporterId = transporterId || (!isAdmin ? user._id.toString() : null);
  if (!effectiveTransporterId) {
    return NextResponse.json({ success: false, message: 'transporterId required' }, { status: 400 });
  }

  const reviews = await Review.find({ agent: effectiveTransporterId })
    .populate('buyer', 'name email businessName phone image')
    .sort({ createdAt: -1 });
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? reviews.reduce((sum: number, review: any) => sum + Number(review.rating || 0), 0) / totalReviews
    : 0;

  return NextResponse.json({
    success: true,
    data: {
      reviews,
      averageRating,
      totalReviews
    },
    reviews
  }, { status: 200 });
}
