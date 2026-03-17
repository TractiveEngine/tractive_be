import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import mongoose from 'mongoose';
import { getAuthUser } from '@/lib/apiAuth';
import { attachWishlistedFlag } from '@/lib/productPayload';

// GET /api/sellers/products/:id - product details wrapper
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const authUser = await getAuthUser(request);

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid product id' }, { status: 400 });
  }

  const product = await Product.findById(id);
  if (!product) {
    return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
  }

  const [normalized] = await attachWishlistedFlag(
    [product.toObject()],
    authUser ? { userId: authUser._id.toString() } : null
  );

  return NextResponse.json({ success: true, data: normalized }, { status: 200 });
}
