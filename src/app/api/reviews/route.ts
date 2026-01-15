import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Review from '@/models/review';
import User from '@/models/user';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return typeof p === 'object' && p !== null && 'userId' in p && typeof (p as JwtUserPayload).userId === 'string';
}

function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || !isJwtUserPayload(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// POST /api/reviews - buyer reviews an agent/transporter
export async function POST(request: Request) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const buyer = await User.findById(userData.userId);
  if (!buyer || !buyer.roles.includes('buyer')) {
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
  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }
  const reviews = await Review.find({ agent: agentId }).populate('buyer', 'name email');
  return NextResponse.json({ reviews }, { status: 200 });
}
