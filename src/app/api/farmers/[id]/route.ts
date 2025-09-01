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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const farmer = await Farmer.findById(id);
  if (!farmer) {
    return NextResponse.json({ error: 'Farmer not found' }, { status: 404 });
  }
  return NextResponse.json({ farmer }, { status: 200 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const user = await User.findById(userData.userId);
  if (!user || user.role !== 'agent') {
    return NextResponse.json({ error: 'Only agents can update farmers' }, { status: 403 });
  }

  const body = await request.json();
  const farmer = await Farmer.findByIdAndUpdate(id, body, { new: true });
  if (!farmer) {
    return NextResponse.json({ error: 'Farmer not found' }, { status: 404 });
  }
  return NextResponse.json({ farmer }, { status: 200 });
}
