import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Farmer from '@/models/farmer';
import User from '@/models/user';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// Define the shape your JWT actually has
type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

// Type guard for JwtUserPayload
function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return typeof p === 'object' && p !== null && 'userId' in p && typeof (p as JwtUserPayload).userId === 'string';
}

// Verify + return a typed payload (or null)
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

export async function POST(request: Request) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const user = await User.findById(userData.userId);
  if (!user || !['agent', 'admin'].includes(user.role)) {
    return NextResponse.json({ error: 'Only agents or admins can create farmers' }, { status: 403 });
  }

  const {
    name, phone, businessName, nin, businessCAC, address,
    country, state, lga, villageOrLocalMarket
  } = await request.json();

  if (!name) {
    return NextResponse.json({ error: 'Farmer name required' }, { status: 400 });
  }

  const farmer = await Farmer.create({
    name,
    phone,
    businessName,
    nin,
    businessCAC,
    address,
    country,
    state,
    lga,
    villageOrLocalMarket,
    createdBy: user._id,
  });

  return NextResponse.json({ farmer }, { status: 201 });
}

export async function GET(request: Request) {
  await dbConnect();
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  // Only return farmers created by the authenticated user
  const farmers = await Farmer.find({ createdBy: userData.userId });
  return NextResponse.json({ farmers }, { status: 200 });
}
