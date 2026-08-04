import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import WishlistItem from '@/models/wishlist';
import Product from '@/models/product';
import Truck from '@/models/truck';
import mongoose from 'mongoose';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

// GET /api/wishlist - Retrieve buyer's wishlist
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ error: 'Only buyers can access wishlist' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const type = (searchParams.get('type') || 'product').toLowerCase();
    const page = Math.max(1, Number(pageParam) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = { buyer: user._id };
    if (type === 'fleet' || type === 'truck') {
      query.fleet = { $ne: null };
    } else {
      query.product = { $ne: null };
    }

    const [wishlistItems, total] = await Promise.all([
      WishlistItem.find(query)
        .populate('product')
        .populate('fleet')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WishlistItem.countDocuments(query)
    ]);

    return NextResponse.json({ 
      success: true, 
      data: wishlistItems.map((item: any) => ({
        ...item.toObject(),
        type: item.fleet ? 'fleet' : 'product'
      })),
      pagination: { page, limit, total }
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/wishlist - Add product or fleet to wishlist
export async function POST(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ error: 'Only buyers can add to wishlist' }, { status: 403 });
  }

  try {
    const { productId, fleetId } = await request.json();

    if (!productId && !fleetId) {
      return NextResponse.json({ error: 'productId or fleetId is required' }, { status: 400 });
    }
    if (productId && fleetId) {
      return NextResponse.json({ error: 'Send only one of productId or fleetId' }, { status: 400 });
    }

    let wishlistItem;
    if (productId) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return NextResponse.json({ error: 'Invalid product ID format' }, { status: 400 });
      }
      const product = await Product.findById(productId);
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      wishlistItem = await WishlistItem.create({
        buyer: user._id,
        product: productId
      });
    } else {
      if (!mongoose.Types.ObjectId.isValid(fleetId)) {
        return NextResponse.json({ error: 'Invalid fleet ID format' }, { status: 400 });
      }
      const fleet = await Truck.findById(fleetId);
      if (!fleet) {
        return NextResponse.json({ error: 'Fleet not found' }, { status: 404 });
      }
      wishlistItem = await WishlistItem.create({
        buyer: user._id,
        fleet: fleetId
      });
    }

    await wishlistItem.populate('product');
    await wishlistItem.populate('fleet');

    return NextResponse.json({ 
      success: true, 
      data: {
        ...wishlistItem.toObject(),
        type: wishlistItem.fleet ? 'fleet' : 'product'
      }
    }, { status: 201 });

  } catch (error: unknown) {
    // Handle duplicate key error (11000)
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      return NextResponse.json({ 
        error: 'Item already in wishlist' 
      }, { status: 409 });
    }
    console.error('Error adding to wishlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/wishlist - Remove product or fleet from wishlist
export async function DELETE(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ error: 'Only buyers can remove from wishlist' }, { status: 403 });
  }

  try {
    const { productId, fleetId } = await request.json();

    if (!productId && !fleetId) {
      return NextResponse.json({ error: 'productId or fleetId is required' }, { status: 400 });
    }
    if (productId && fleetId) {
      return NextResponse.json({ error: 'Send only one of productId or fleetId' }, { status: 400 });
    }

    if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
      return NextResponse.json({ error: 'Invalid product ID format' }, { status: 400 });
    }
    if (fleetId && !mongoose.Types.ObjectId.isValid(fleetId)) {
      return NextResponse.json({ error: 'Invalid fleet ID format' }, { status: 400 });
    }

    const result = await WishlistItem.deleteOne({
      buyer: user._id,
      ...(productId ? { product: productId } : { fleet: fleetId })
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Item not in wishlist' 
      }, { status: 200 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Item removed from wishlist' 
    }, { status: 200 });

  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
