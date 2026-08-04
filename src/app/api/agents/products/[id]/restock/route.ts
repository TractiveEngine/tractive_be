import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Agent or admin access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid product id' }, { status: 400 });
  }

  const product = await Product.findById(id);
  if (!product) {
    return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
  }

  if (!ensureActiveRole(user, 'admin') && product.owner?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized to restock this product' }, { status: 403 });
  }

  const body: any = await request.json().catch(() => ({}));
  const addQuantity = Number(body?.quantity ?? body?.addQuantity ?? body?.restockQuantity);
  if (!Number.isFinite(addQuantity) || addQuantity <= 0) {
    return NextResponse.json({ success: false, message: 'Valid quantity to add is required' }, { status: 400 });
  }

  product.quantity = Number(product.quantity || 0) + addQuantity;
  if (product.status !== 'discontinued') {
    product.status = product.quantity > 0 ? 'available' : 'out_of_stock';
  }
  await product.save();

  return NextResponse.json({
    success: true,
    data: product,
    message: 'Product restocked successfully'
  }, { status: 200 });
}
