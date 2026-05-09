import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import SellerFollow from '@/models/sellerFollow';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can follow transporters' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transporter id' }, { status: 400 });
  }

  const transporter = await User.findById(id).select('_id roles status');
  if (!transporter || !transporter.roles?.includes('transporter') || transporter.status === 'removed') {
    return NextResponse.json({ success: false, message: 'Transporter not found' }, { status: 404 });
  }

  const follow = await SellerFollow.findOneAndUpdate(
    { buyer: user._id, seller: transporter._id },
    { $setOnInsert: { buyer: user._id, seller: transporter._id } },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true, data: follow, message: 'Transporter followed' }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can unfollow transporters' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transporter id' }, { status: 400 });
  }

  await SellerFollow.deleteOne({ buyer: user._id, seller: id });
  return NextResponse.json({ success: true, message: 'Unfollowed transporter' }, { status: 200 });
}
