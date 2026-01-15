import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import NegotiationOffer from '@/models/negotiation';
import ShippingRequest from '@/models/shipping';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createNotification } from '@/lib/notifications';

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

// POST /api/negotiations/[id]/reject - Reject negotiation offer
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('buyer')) {
    return NextResponse.json({ error: 'Only buyers can reject negotiations' }, { status: 403 });
  }

  try {
    const { id } = params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid negotiation ID format' }, { status: 400 });
    }

    // Find negotiation
    const negotiation = await NegotiationOffer.findById(id)
      .populate('shippingRequest');

    if (!negotiation) {
      return NextResponse.json({ error: 'Negotiation not found' }, { status: 404 });
    }

    // Get shipping request
    const shippingRequest = await ShippingRequest.findById(negotiation.shippingRequest._id);
    if (!shippingRequest) {
      return NextResponse.json({ error: 'Shipping request not found' }, { status: 404 });
    }

    // Verify buyer owns this shipping request
    if (shippingRequest.buyer.toString() !== user._id.toString()) {
      return NextResponse.json({ 
        error: 'Not authorized to reject this negotiation' 
      }, { status: 403 });
    }

    // Check if negotiation is still pending
    if (negotiation.negotiationStatus !== 'pending') {
      return NextResponse.json({ 
        error: 'This negotiation has already been processed' 
      }, { status: 400 });
    }

    // Reject negotiation
    negotiation.negotiationStatus = 'rejected';
    await negotiation.save();

    // Populate details
    await negotiation.populate('transporter', 'name email businessName');

    // Notify transporter about rejection
    await createNotification({
      userId: negotiation.transporter.toString(),
      type: 'shipping_rejected',
      title: 'Shipping negotiation rejected',
      message: `Your shipping offer of ${negotiation.amount} was rejected`,
      metadata: {
        negotiationId: negotiation._id.toString(),
        shippingRequestId: negotiation.shippingRequest.toString(),
        amount: negotiation.amount
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: negotiation 
    }, { status: 200 });

  } catch (error) {
    console.error('Error rejecting negotiation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
