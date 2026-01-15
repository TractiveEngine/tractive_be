import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import Farmer from '@/models/farmer';
import Product from '@/models/product';
import mongoose from 'mongoose';

// GET /api/sellers/:id - seller profile
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await dbConnect();

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid seller id' }, { status: 400 });
  }

  const seller = await User.findById(id);
  if (!seller) {
    return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
  }

  const farmers = await Farmer.find({ createdBy: id });
  const productsCount = await Product.countDocuments({ owner: id });

  return NextResponse.json(
    {
      success: true,
      data: {
        sellerId: seller._id.toString(),
        name: seller.name || seller.businessName,
        email: seller.email,
        roles: seller.roles,
        activeRole: seller.activeRole,
        farmers,
        productsCount
      }
    },
    { status: 200 }
  );
}
