import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// Simple recommendation: popular/available products ordered by recency
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can view recommendations' }, { status: 403 });
  }

  const products = await Product.find({ status: 'available' }).sort({ createdAt: -1 }).limit(12);
  return NextResponse.json({ success: true, data: products }, { status: 200 });
}
