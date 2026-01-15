import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import mongoose from 'mongoose';

// GET /api/sellers/products/:id - product details wrapper
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await dbConnect();

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid product id' }, { status: 400 });
  }

  const product = await Product.findById(id);
  if (!product) {
    return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: product }, { status: 200 });
}
