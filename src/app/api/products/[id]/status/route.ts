import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

const STATUS = ['available', 'out_of_stock', 'discontinued'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin') && !ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ success: false, message: 'Only admin or agent can update product status' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid product id' }, { status: 400 });
  }

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status;
  if (!STATUS.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }

  const product = await Product.findById(id);
  if (!product) {
    return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
  }

  product.status = status;
  if (status === 'out_of_stock') {
    product.quantity = 0;
  }
  product.updatedAt = new Date();
  await product.save();

  return NextResponse.json({ success: true, data: product }, { status: 200 });
}
