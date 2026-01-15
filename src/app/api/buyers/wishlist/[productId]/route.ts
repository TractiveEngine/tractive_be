import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import WishlistItem from '@/models/wishlist';
import Product from '@/models/product';
import mongoose from 'mongoose';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// POST /api/buyers/wishlist/:productId - add to wishlist
export async function POST(request: Request, { params }: { params: { productId: string } }) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can add to wishlist' }, { status: 403 });
  }

  const { productId } = params;
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return NextResponse.json({ success: false, message: 'Invalid product ID' }, { status: 400 });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
  }

  try {
    const wishlistItem = await WishlistItem.create({
      buyer: user._id,
      product: productId,
    });
    await wishlistItem.populate('product');
    return NextResponse.json({ success: true, data: wishlistItem }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ success: true, message: 'Product already in wishlist' }, { status: 200 });
    }
    console.error('Error adding wishlist item:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/buyers/wishlist/:productId - remove from wishlist
export async function DELETE(request: Request, { params }: { params: { productId: string } }) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can remove from wishlist' }, { status: 403 });
  }

  const { productId } = params;
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return NextResponse.json({ success: false, message: 'Invalid product ID' }, { status: 400 });
  }

  const result = await WishlistItem.deleteOne({ buyer: user._id, product: productId });
  if (result.deletedCount === 0) {
    return NextResponse.json({ success: true, message: 'Product not in wishlist' }, { status: 200 });
  }
  return NextResponse.json({ success: true, message: 'Product removed from wishlist' }, { status: 200 });
}
