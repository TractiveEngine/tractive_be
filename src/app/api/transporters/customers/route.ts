import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import NegotiationOffer from '@/models/negotiation';
import ShippingRequest from '@/models/shipping';
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

// GET /api/transporters/customers - Get list of customers served by transporter
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('transporter')) {
    return NextResponse.json({ error: 'Only transporters can view customers' }, { status: 403 });
  }

  try {
    // Get buyers from orders assigned to this transporter
    const orders = await Order.find({ transporter: user._id })
      .populate('buyer', 'name email businessName phone');

    // Get buyers from accepted negotiations
    const acceptedNegotiations = await NegotiationOffer.find({
      transporter: user._id,
      negotiationStatus: 'accepted'
    }).populate('shippingRequest');

    const shippingRequestIds = acceptedNegotiations.map(n => n.shippingRequest._id);
    const shippingRequests = await ShippingRequest.find({
      _id: { $in: shippingRequestIds }
    }).populate('buyer', 'name email businessName phone');

    // Combine and deduplicate buyers
    const buyerMap = new Map();

    // Add buyers from orders
    orders.forEach(order => {
      if (order.buyer) {
        const buyerId = order.buyer._id.toString();
        if (!buyerMap.has(buyerId)) {
          buyerMap.set(buyerId, {
            buyerId: order.buyer._id,
            name: order.buyer.name || order.buyer.businessName || 'Unknown',
            email: order.buyer.email,
            ordersCount: 0
          });
        }
        buyerMap.get(buyerId).ordersCount++;
      }
    });

    // Add buyers from shipping requests
    shippingRequests.forEach(request => {
      if (request.buyer) {
        const buyerId = request.buyer._id.toString();
        if (!buyerMap.has(buyerId)) {
          buyerMap.set(buyerId, {
            buyerId: request.buyer._id,
            name: request.buyer.name || request.buyer.businessName || 'Unknown',
            email: request.buyer.email,
            ordersCount: 0
          });
        }
        // Count shipping requests as orders
        buyerMap.get(buyerId).ordersCount++;
      }
    });

    const customers = Array.from(buyerMap.values());

    return NextResponse.json({ 
      success: true, 
      data: customers 
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
