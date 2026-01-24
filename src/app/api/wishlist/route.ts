import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import WishlistItem from '@/models/wishlist';
import Product from '@/models/product';
import User from '@/models/user';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type JwtUserPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

function isJwtUserPayload(p: unknown): p is JwtUserPayload {
  return typeof p === 'object' && p !== null && 'userId' in p && typeof (p as JwtUserPayload).userId === 'string';
}

function getUserFromRequest(request: Request): JwtUserPayload | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || !isJwtUserPayload(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/wishlist - Retrieve buyer's wishlist
export async function GET(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('buyer')) {
    return NextResponse.json({ error: 'Only buyers can access wishlist' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const page = Math.max(1, Number(pageParam) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
    const skip = (page - 1) * limit;

    const [wishlistItems, total] = await Promise.all([
      WishlistItem.find({ buyer: user._id })
        .populate('product')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WishlistItem.countDocuments({ buyer: user._id })
    ]);

    return NextResponse.json({ 
      success: true, 
      data: wishlistItems,
      pagination: { page, limit, total }
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/wishlist - Add product to wishlist
export async function POST(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('buyer')) {
    return NextResponse.json({ error: 'Only buyers can add to wishlist' }, { status: 403 });
  }

  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return NextResponse.json({ error: 'Invalid product ID format' }, { status: 400 });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Try to create wishlist item
    const wishlistItem = await WishlistItem.create({
      buyer: user._id,
      product: productId
    });

    // Populate product details
    await wishlistItem.populate('product');

    return NextResponse.json({ 
      success: true, 
      data: wishlistItem 
    }, { status: 201 });

  } catch (error: unknown) {
    // Handle duplicate key error (11000)
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      return NextResponse.json({ 
        error: 'Product already in wishlist' 
      }, { status: 409 });
    }
    console.error('Error adding to wishlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/wishlist - Remove product from wishlist
export async function DELETE(request: Request) {
  await dbConnect();

  const userData = getUserFromRequest(request);
  if (!userData) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const user = await User.findById(userData.userId);
  if (!user || !user.roles.includes('buyer')) {
    return NextResponse.json({ error: 'Only buyers can remove from wishlist' }, { status: 403 });
  }

  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return NextResponse.json({ error: 'Invalid product ID format' }, { status: 400 });
    }

    const result = await WishlistItem.deleteOne({
      buyer: user._id,
      product: productId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Product not in wishlist' 
      }, { status: 200 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Product removed from wishlist' 
    }, { status: 200 });

  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
