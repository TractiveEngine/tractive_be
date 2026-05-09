import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole, hasRole } from '@/lib/apiAuth';

// POST /api/reviews - buyer reviews an agent/transporter
export async function POST(request: Request) {
  await dbConnect();
  const buyer = await getAuthUser(request);
  if (!buyer) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(buyer, 'buyer')) {
    return NextResponse.json({ error: 'Only buyers can review agents' }, { status: 403 });
  }

  const { agentId, rating, comment } = await request.json();
  if (!agentId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Agent, rating (1-5) required' }, { status: 400 });
  }

  const agent = await User.findById(agentId);
  if (!agent || (!agent.roles.includes('agent') && !agent.roles.includes('transporter'))) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const review = await Review.create({
    agent: agent._id,
    buyer: buyer._id,
    rating,
    comment
  });

  return NextResponse.json({ review }, { status: 201 });
}

// GET /api/reviews?agentId=xxx - get all reviews for an agent
export async function GET(request: Request) {
  await dbConnect();
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  let effectiveAgentId = agentId;
  if (!effectiveAgentId) {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    const canReadOwnReviews =
      ensureActiveRole(authUser, 'agent') ||
      ensureActiveRole(authUser, 'transporter') ||
      ensureActiveRole(authUser, 'admin') ||
      hasRole(authUser, 'agent') ||
      hasRole(authUser, 'transporter') ||
      hasRole(authUser, 'admin');

    if (!canReadOwnReviews) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }
    effectiveAgentId = authUser._id.toString();
  }

  const reviews = await Review.find({ agent: effectiveAgentId })
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
