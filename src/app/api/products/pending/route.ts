import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  if (!ensureActiveRole(user, 'admin') && !ensureActiveRole(user, 'agent')) {
    return NextResponse.json(
      { success: false, message: 'Only admin or agent can view pending products' },
      { status: 403 }
    );
  }

  const query: Record<string, unknown> = {};
  if (ensureActiveRole(user, 'agent')) {
    query.owner = user._id;
  }

  const products = await Product.find(query)
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const pendingProducts = products.filter((product: any) => {
    if (product?.status === 'pending') return true;
    return false;
  });

  return NextResponse.json(
    {
      success: true,
      data: pendingProducts,
      message:
        'Products currently support available, out_of_stock, and discontinued states. Pending products will be empty until a pending status is introduced.'
    },
    { status: 200 }
  );
}
