import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import SellerFollow from '@/models/sellerFollow';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// POST /api/buyers/sellers/:sellerId/follow
export async function POST(request: Request, { params }: { params: Promise<{ sellerId: string }> }) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can follow sellers' }, { status: 403 });
  }

  const { sellerId } = await params;
  if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
    return NextResponse.json({ success: false, message: 'Invalid seller ID' }, { status: 400 });
  }

  const seller = await User.findById(sellerId).select('_id roles status');
  if (!seller) {
    return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
  }
  if (!seller.roles?.includes('agent')) {
    return NextResponse.json({ success: false, message: 'Seller must be an agent account' }, { status: 400 });
  }
  if (seller.status === 'removed') {
    return NextResponse.json({ success: false, message: 'Seller not available' }, { status: 404 });
  }

  const follow = await SellerFollow.findOneAndUpdate(
    { buyer: user._id, seller: sellerId },
    { $setOnInsert: { buyer: user._id, seller: sellerId } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true, data: follow, message: 'Seller followed' }, { status: 201 });
}

// DELETE /api/buyers/sellers/:sellerId/follow
export async function DELETE(request: Request, { params }: { params: Promise<{ sellerId: string }> }) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can unfollow sellers' }, { status: 403 });
  }

  const { sellerId } = await params;
  if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
    return NextResponse.json({ success: false, message: 'Invalid seller ID' }, { status: 400 });
  }

  await SellerFollow.deleteOne({ buyer: user._id, seller: sellerId });
  return NextResponse.json({ success: true, message: 'Unfollowed seller' }, { status: 200 });
}

