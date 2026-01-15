import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import Farmer from '@/models/farmer';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

export async function GET(request: Request, { params }: { params: { categoryId: string; subcategoryId: string } }) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can browse farmers by category' }, { status: 403 });
  }

  const { categoryId, subcategoryId } = params;

  const products = await Product.find({
    categories: { $in: [categoryId, subcategoryId].filter(Boolean) }
  });

  const farmerIds = Array.from(
    new Set(
      products
        .map((p) => p.farmer)
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
        .map((f) => f.toString())
    )
  );

  const farmers = await Farmer.find({ _id: { $in: farmerIds } });

  return NextResponse.json({ success: true, data: farmers }, { status: 200 });
}
