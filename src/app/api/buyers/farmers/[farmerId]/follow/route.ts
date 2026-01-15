import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Farmer from '@/models/farmer';
import FarmerFollow from '@/models/farmerFollow';
import mongoose from 'mongoose';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// POST /api/buyers/farmers/:farmerId/follow
export async function POST(request: Request, { params }: { params: { farmerId: string } }) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can follow farmers' }, { status: 403 });
  }

  const { farmerId } = params;
  if (!farmerId || !mongoose.Types.ObjectId.isValid(farmerId)) {
    return NextResponse.json({ success: false, message: 'Invalid farmer ID' }, { status: 400 });
  }

  const farmer = await Farmer.findById(farmerId);
  if (!farmer) {
    return NextResponse.json({ success: false, message: 'Farmer not found' }, { status: 404 });
  }

  try {
    const follow = await FarmerFollow.findOneAndUpdate(
      { buyer: user._id, farmer: farmerId },
      { $setOnInsert: { buyer: user._id, farmer: farmerId } },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: follow }, { status: 201 });
  } catch (error) {
    console.error('Error following farmer:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/buyers/farmers/:farmerId/follow
export async function DELETE(request: Request, { params }: { params: { farmerId: string } }) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can unfollow farmers' }, { status: 403 });
  }

  const { farmerId } = params;
  if (!farmerId || !mongoose.Types.ObjectId.isValid(farmerId)) {
    return NextResponse.json({ success: false, message: 'Invalid farmer ID' }, { status: 400 });
  }

  await FarmerFollow.deleteOne({ buyer: user._id, farmer: farmerId });
  return NextResponse.json({ success: true, message: 'Unfollowed farmer' }, { status: 200 });
}
