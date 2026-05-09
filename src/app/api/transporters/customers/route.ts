import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import NegotiationOffer from '@/models/negotiation';
import ShippingRequest from '@/models/shipping';
import FleetTrip from '@/models/fleetTrip';
import FleetBooking from '@/models/fleetBooking';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

// GET /api/transporters/customers - Get list of customers served by transporter
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
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

    const [trips, bookings] = await Promise.all([
      FleetTrip.find({ transporter: user._id })
        .populate('buyerIds', 'name email businessName phone'),
      FleetBooking.find({ transporter: user._id, status: { $in: ['confirmed', 'completed'] } })
        .populate('buyer', 'name email businessName phone')
    ]);

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

    trips.forEach((trip: any) => {
      (trip.buyerIds || []).forEach((buyer: any) => {
        const buyerId = buyer._id.toString();
        if (!buyerMap.has(buyerId)) {
          buyerMap.set(buyerId, {
            buyerId: buyer._id,
            name: buyer.name || buyer.businessName || 'Unknown',
            email: buyer.email,
            ordersCount: 0
          });
        }
      });
    });

    bookings.forEach((booking: any) => {
      if (booking.buyer) {
        const buyerId = booking.buyer._id.toString();
        if (!buyerMap.has(buyerId)) {
          buyerMap.set(buyerId, {
            buyerId: booking.buyer._id,
            name: booking.buyer.name || booking.buyer.businessName || 'Unknown',
            email: booking.buyer.email,
            ordersCount: 0
          });
        }
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
