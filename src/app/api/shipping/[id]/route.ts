import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ShippingRequest from '@/models/shipping';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

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

// GET /api/shipping/[id] - Get shipping request by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const { id } = params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid shipping request ID format' }, { status: 400 });
    }

    const shippingRequest = await ShippingRequest.findById(id)
      .populate('product')
      .populate('buyer', 'name email businessName phone')
      .populate('transporter', 'name email businessName phone');

    if (!shippingRequest) {
      return NextResponse.json({ error: 'Shipping request not found' }, { status: 404 });
    }

    // Check authorization - buyer can see their own, transporter can see assigned ones
    const isBuyer = user.roles.includes('buyer') && shippingRequest.buyer._id.toString() === user._id.toString();
    const isTransporter = user.roles.includes('transporter') && 
      shippingRequest.transporter && 
      shippingRequest.transporter._id.toString() === user._id.toString();
    const isAdmin = user.roles.includes('admin');

    if (!isBuyer && !isTransporter && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to view this shipping request' }, { status: 403 });
    }

    return NextResponse.json({ 
      success: true, 
      data: shippingRequest 
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching shipping request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
