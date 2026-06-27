import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import { getAuthUser, hasRole } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  let agentId = searchParams.get('agentId');

  if (!agentId) {
    const user = await getAuthUser(request);
    if (!user || (!hasRole(user, 'agent') && !hasRole(user, 'transporter') && !hasRole(user, 'admin'))) {
      return NextResponse.json({ success: false, message: 'agentId required' }, { status: 400 });
    }
    agentId = user._id.toString();
  }

  const reviews = await Review.find({ agent: agentId })
    .populate('buyer', '_id name businessName image')
    .sort({ createdAt: -1 })
    .lean();

  const totalReviews = reviews.length;
  const overallRating = totalReviews > 0
    ? Number((reviews.reduce((sum: number, review: any) => sum + Number(review.rating || 0), 0) / totalReviews).toFixed(1))
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((review: any) => Number(review.rating) === rating).length;
    return {
      rating,
      count,
      percentage: totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      overallRating,
      totalReviews,
      ratingDistribution,
      recentReviewers: reviews.slice(0, 5).map((review: any) => ({
        id: review.buyer?._id?.toString?.() || null,
        name: review.buyer?.name || review.buyer?.businessName || 'Anonymous',
        avatar: review.buyer?.image || null
      }))
    }
  }, { status: 200 });
}

