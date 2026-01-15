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

// POST /api/negotiations/[id]/accept - Accept negotiation offer
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
    return NextResponse.json({ error: 'Only buyers can accept negotiations' }, { status: 403 });
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
        error: 'Not authorized to accept this negotiation' 
      }, { status: 403 });
    }

    // Check if negotiation is still pending
    if (negotiation.negotiationStatus !== 'pending') {
      return NextResponse.json({ 
        error: 'This negotiation has already been processed' 
      }, { status: 400 });
    }

    // Accept negotiation
    negotiation.negotiationStatus = 'accepted';
    await negotiation.save();

    // Update shipping request
    shippingRequest.status = 'accepted';
    shippingRequest.transporter = negotiation.transporter;
    shippingRequest.negotiationPrice = negotiation.amount;
    await shippingRequest.save();

    // Reject all other pending negotiations for this shipping request
    await NegotiationOffer.updateMany(
      {
        shippingRequest: shippingRequest._id,
        _id: { $ne: negotiation._id },
        negotiationStatus: 'pending'
      },
      {
        negotiationStatus: 'rejected'
      }
    );

    // Populate details
    await negotiation.populate('transporter', 'name email businessName');

    // Notify transporter about acceptance
    await createNotification({
      userId: negotiation.transporter.toString(),
      type: 'shipping_accepted',
      title: 'Shipping negotiation accepted',
      message: `Your shipping offer of ${negotiation.amount} was accepted`,
      metadata: {
        negotiationId: negotiation._id.toString(),
        shippingRequestId: shippingRequest._id.toString(),
        amount: negotiation.amount,
        weightInKG: negotiation.weightInKG
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        negotiation,
        shippingRequest
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error accepting negotiation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
