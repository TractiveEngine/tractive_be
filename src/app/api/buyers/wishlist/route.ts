import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import WishlistItem from '@/models/wishlist';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/buyers/wishlist - buyer wishlist wrapper
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can access wishlist' }, { status: 403 });
  }

  try {
    const wishlistItems = await WishlistItem.find({ buyer: user._id })
      .populate('product')
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: wishlistItems }, { status: 200 });
  } catch (error) {
    console.error('Error fetching buyer wishlist:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
