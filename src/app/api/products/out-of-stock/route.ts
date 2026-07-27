import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin') && !ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ success: false, message: 'Only admin or agent can view out-of-stock products' }, { status: 403 });
  }

  const query: Record<string, unknown> = {
    status: 'out_of_stock'
  };
  if (ensureActiveRole(user, 'agent')) {
    query.owner = user._id;
  }

  const products = await Product.find(query).sort({ updatedAt: -1 });

  return NextResponse.json({ success: true, data: products }, { status: 200 });
}
