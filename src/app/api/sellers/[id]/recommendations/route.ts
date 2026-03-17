import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import mongoose from 'mongoose';
import { getAuthUser } from '@/lib/apiAuth';
import { attachWishlistedFlag } from '@/lib/productPayload';

// GET /api/sellers/:id/recommendations
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const authUser = await getAuthUser(request);
  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid seller id' }, { status: 400 });
  }

  const products = await Product.find({ owner: id, status: 'available' })
    .select('_id name images price categories category subcategory')
    .sort({ createdAt: -1 })
    .limit(12);

  const normalized = await attachWishlistedFlag(
    products.map((product) => product.toObject()),
    authUser ? { userId: authUser._id.toString() } : null
  );

  const data = normalized.map((product) => ({
    id: product._id?.toString(),
    name: product.name,
    image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null,
    images: product.images,
    price: product.price,
    category: product.category,
    subcategory: product.subcategory,
    categories: product.categories,
    wishlisted: product.wishlisted
  }));

  return NextResponse.json({ success: true, data }, { status: 200 });
}
