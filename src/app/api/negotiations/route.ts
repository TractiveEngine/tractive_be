import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import NegotiationOffer from '@/models/negotiation';
import ShippingRequest from '@/models/shipping';
import User from '@/models/user';
import Truck from '@/models/truck';
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

// GET /api/negotiations - Get negotiation requests for transporter
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('transporter')) {
    return NextResponse.json({ error: 'Only transporters can view negotiations' }, { status: 403 });
  }

  try {
    // Get transporter's trucks to find their routes
    const trucks = await Truck.find({ transporter: user._id });
    const routes = trucks.map(truck => ({
      from: truck.route?.fromState,
      to: truck.route?.toState
    })).filter(route => route.from && route.to);

    // Find shipping requests that:
    // 1. Match transporter's routes (future enhancement - for now get all pending)
    // 2. Already assigned to this transporter
    // 3. Are in negotiation status
    const shippingRequests = await ShippingRequest.find({
      $or: [
        { status: 'pending' },
        { status: 'in_negotiation', transporter: user._id },
        { transporter: user._id }
      ]
    })
      .populate('product')
      .populate('buyer', 'name email businessName phone')
      .sort({ createdAt: -1 });

    // Get existing negotiations for these requests
    const requestIds = shippingRequests.map(req => req._id);
    const negotiations = await NegotiationOffer.find({
      shippingRequest: { $in: requestIds },
      transporter: user._id
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        shippingRequests,
        myNegotiations: negotiations,
        routes
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching negotiations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/negotiations - Create negotiation offer
export async function POST(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('transporter')) {
    return NextResponse.json({ error: 'Only transporters can create negotiations' }, { status: 403 });
  }

  try {
    const { 
      shippingRequestId, 
      amount, 
      weightInKG, 
      routeFrom, 
      routeTo 
    } = await request.json();

    // Validate required fields
    if (!shippingRequestId || !amount || !weightInKG || !routeFrom || !routeTo) {
      return NextResponse.json({ 
        error: 'Shipping request ID, amount, weight, and route details are required' 
      }, { status: 400 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(shippingRequestId)) {
      return NextResponse.json({ error: 'Invalid shipping request ID format' }, { status: 400 });
    }

    // Check if shipping request exists
    const shippingRequest = await ShippingRequest.findById(shippingRequestId);
    if (!shippingRequest) {
      return NextResponse.json({ error: 'Shipping request not found' }, { status: 404 });
    }

    // Check if shipping request is still open for negotiation
    if (shippingRequest.status === 'accepted' || shippingRequest.status === 'rejected') {
      return NextResponse.json({ 
        error: 'This shipping request is no longer open for negotiation' 
      }, { status: 400 });
    }

    // Create negotiation offer
    const negotiation = await NegotiationOffer.create({
      shippingRequest: shippingRequest._id,
      transporter: user._id,
      negotiatorName: user.businessName || user.name || 'Transporter',
      amount: amount,
      weightInKG: weightInKG,
      routeFrom: routeFrom,
      routeTo: routeTo,
      negotiationStatus: 'pending'
    });

    // Update shipping request status to in_negotiation
    shippingRequest.status = 'in_negotiation';
    await shippingRequest.save();

    // Populate details
    await negotiation.populate('shippingRequest');
    await negotiation.populate('transporter', 'name email businessName');

    return NextResponse.json({ 
      success: true, 
      data: negotiation 
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating negotiation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
