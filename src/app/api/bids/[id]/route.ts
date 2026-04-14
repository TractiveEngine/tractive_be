import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Bid from '@/models/bid';
import User from '@/models/user';
import Product from '@/models/product';
import Order from '@/models/order';
import jwt from 'jsonwebtoken';
import { createNotification } from '@/lib/notifications';
import { getEffectiveProductBidAmount } from '@/lib/productBidAmount';
import { releaseProductInventory, reserveProductInventory } from '@/lib/productInventory';

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

// Use Promise for params to match Next.js App Router signature
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const bid = await Bid.findById(id).populate('product buyer agent');
  if (!bid) {
    return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
  }
  return NextResponse.json({ bid }, { status: 200 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const user = await User.findById(userData.userId);
  const bid = await Bid.findById(id);
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
  const requestedStatus = body?.status;
  const isAgent = user._id.equals(bid.agent);
  const isBuyer = user._id.equals(bid.buyer);

  if (requestedStatus && !['pending', 'accepted', 'rejected', 'countered'].includes(requestedStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const product = await Product.findById(bid.product);

  const oldStatus = bid.status;
  if (oldStatus === 'accepted' && requestedStatus && requestedStatus !== 'accepted') {
    const linkedOrder = await Order.findOne({ bidIds: bid._id }).select('_id status');
    if (linkedOrder) {
      return NextResponse.json({ error: 'Accepted bid cannot be changed after it has been attached to an order' }, { status: 400 });
    }
  }

  if (isAgent) {
    if (requestedStatus === 'countered' || body?.counterOffer !== undefined) {
      const counterOffer = Number(body?.counterOffer);
      if (!Number.isFinite(counterOffer) || counterOffer <= 0) {
        return NextResponse.json({ error: 'Valid counterOffer is required when countering a bid' }, { status: 400 });
      }
      bid.status = 'countered';
      bid.counterOffer = counterOffer;
      bid.responseMessage = body?.message ?? body?.responseMessage ?? null;
    } else {
      if (requestedStatus && !['pending', 'accepted', 'rejected'].includes(requestedStatus)) {
        return NextResponse.json({ error: 'Invalid status for agent update' }, { status: 400 });
      }
      if (requestedStatus) {
        bid.status = requestedStatus;
      }
      if (typeof body?.message === 'string') {
        bid.responseMessage = body.message;
      }
      if (requestedStatus === 'accepted') {
        bid.counterOffer = null;
      }
    }
  } else if (isBuyer) {
    if (bid.status !== 'countered') {
      return NextResponse.json({ error: 'Buyer can only respond to countered bids' }, { status: 400 });
    }

    const newOfferAmount = body?.amount ?? body?.proposedPrice;
    if (newOfferAmount !== undefined && newOfferAmount !== null) {
      const parsedAmount = Number(newOfferAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: 'Valid amount is required when sending a new offer' }, { status: 400 });
      }
      bid.amount = parsedAmount;
      bid.status = 'pending';
      bid.counterOffer = null;
      bid.responseMessage = body?.message ?? body?.responseMessage ?? null;
      bid.updatedAt = new Date();
      await bid.save();

      await createNotification({
        userId: bid.agent.toString(),
        type: 'generic',
        title: 'Buyer sent a new offer',
        message: `Buyer sent a new offer of ${parsedAmount} on ${product?.name || 'a product'}`,
        metadata: {
          productId: bid.product.toString(),
          bidId: bid._id.toString(),
          amount: parsedAmount
        }
      });

      return NextResponse.json({ bid }, { status: 200 });
    }

    if (!['accepted', 'rejected'].includes(requestedStatus)) {
      return NextResponse.json({ error: 'Buyer can accept, reject, or send a new offer on a countered bid' }, { status: 400 });
    }
    bid.status = requestedStatus;
    bid.responseMessage = body?.message ?? body?.responseMessage ?? null;
  }

  bid.updatedAt = new Date();
  if (oldStatus !== 'accepted' && bid.status === 'accepted') {
    try {
      await reserveProductInventory(bid.product, bid.quantity);
    } catch (error: any) {
      return NextResponse.json({ error: error?.message || 'Failed to reserve product inventory' }, { status: 400 });
    }
  }
  if (oldStatus === 'accepted' && bid.status !== 'accepted') {
    try {
      await releaseProductInventory(bid.product, bid.quantity);
    } catch (error: any) {
      return NextResponse.json({ error: error?.message || 'Failed to release product inventory' }, { status: 400 });
    }
  }

  await bid.save();

  const effectiveAmount = getEffectiveProductBidAmount(bid);

  if (bid.status === 'countered' && oldStatus !== 'countered') {
    await createNotification({
      userId: bid.buyer.toString(),
      type: 'generic',
      title: 'Counter offer received',
      message: `You received a counter offer of ${effectiveAmount} on ${product?.name || 'a product'}`,
      metadata: {
        productId: bid.product.toString(),
        bidId: bid._id.toString(),
        amount: effectiveAmount,
        originalAmount: bid.amount
      }
    });
  }

  // Notify buyer when bid is accepted
  if (bid.status === 'accepted' && oldStatus !== 'accepted') {
    await createNotification({
      userId: bid.buyer.toString(),
      type: 'bid_accepted',
      title: 'Your bid was accepted',
      message: `Your bid of ${effectiveAmount} on ${product?.name || 'a product'} was accepted`,
      metadata: {
        productId: bid.product.toString(),
        bidId: bid._id.toString(),
        amount: effectiveAmount
      }
    });
  }

  if (isBuyer && oldStatus === 'countered') {
    await createNotification({
      userId: bid.agent.toString(),
      type: 'generic',
      title: bid.status === 'accepted' ? 'Counter offer accepted' : 'Counter offer rejected',
      message:
        bid.status === 'accepted'
          ? `Buyer accepted your counter offer of ${effectiveAmount} on ${product?.name || 'a product'}`
          : `Buyer rejected your counter offer on ${product?.name || 'a product'}`,
      metadata: {
        productId: bid.product.toString(),
        bidId: bid._id.toString(),
        amount: effectiveAmount
      }
    });
  }

  return NextResponse.json({ bid }, { status: 200 });
}
