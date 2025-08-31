import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Bid from '@/models/bid';
import User from '@/models/user';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: any): p is JwtUserPayload {
  return p && typeof p === 'object' && typeof p.userId === 'string';
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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const bid = await Bid.findById(params.id).populate('product buyer agent');
  if (!bid) {
    return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
  }
  return NextResponse.json({ bid }, { status: 200 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const user = await User.findById(userData.userId);
  const bid = await Bid.findById(params.id);
  if (!bid) {
    return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
  }

  // Only agent who owns the product or buyer who placed the bid can update
  if (
    !(user._id.equals(bid.agent) || user._id.equals(bid.buyer))
  ) {
    return NextResponse.json({ error: 'Not authorized to update this bid' }, { status: 403 });
  }

  const body = await request.json();
  // Only allow status update to pending, accepted, rejected
  if (body.status && !['pending', 'accepted', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  Object.assign(bid, body, { updatedAt: new Date() });
  await bid.save();

  return NextResponse.json({ bid }, { status: 200 });
}
