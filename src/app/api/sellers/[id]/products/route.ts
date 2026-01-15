import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import mongoose from 'mongoose';

// GET /api/sellers/:id/products - products by seller (owner or farmer link)
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await dbConnect();

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid seller id' }, { status: 400 });
  }

  const products = await Product.find({
    $or: [{ owner: id }, { farmer: id }]
  }).sort({ createdAt: -1 });

  return NextResponse.json({ success: true, data: products }, { status: 200 });
}
