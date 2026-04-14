import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import Bid from '@/models/bid';
import User from '@/models/user';
import { createNotification } from '@/lib/notifications';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';
import { getUnitWeightKg } from '@/lib/productUnit';

// POST /api/buyers/products/:productId/bid - place a bid
export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> | { productId: string } }
) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can place bids' }, { status: 403 });
  }

  const { productId } = await Promise.resolve(params);
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return NextResponse.json({ success: false, message: 'Invalid product ID' }, { status: 400 });
  }

  const { amount, message, quantity } = await request.json();
  if (!amount || !quantity) {
    return NextResponse.json({ success: false, message: 'Amount and quantity are required' }, { status: 400 });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
  }
  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return NextResponse.json({ success: false, message: 'Quantity must be a valid positive number' }, { status: 400 });
  }
  if (product.status !== 'available' || Number(product.quantity || 0) < numericQuantity) {
    return NextResponse.json({ success: false, message: 'Requested quantity exceeds available stock' }, { status: 400 });
  }

  const agent = await User.findById(product.owner);

  const bid = await Bid.create({
    product: product._id,
    buyer: user._id,
    agent: agent ? agent._id : undefined,
    amount,
    quantity: numericQuantity,
    unit: product.unit,
    unitWeightKg: product.unitWeightKg ?? getUnitWeightKg(product.unit),
    message,
    status: 'pending'
  });

  if (agent) {
    await createNotification({
      userId: agent._id.toString(),
      type: 'bid_created',
      title: 'New bid received',
      message: `You received a new bid of ${amount} on ${product.name}`,
      metadata: {
        productId: product._id.toString(),
        bidId: bid._id.toString(),
        amount,
        buyerName: user.name || user.email
      }
    });
  }

  return NextResponse.json({ success: true, data: bid }, { status: 201 });
}
