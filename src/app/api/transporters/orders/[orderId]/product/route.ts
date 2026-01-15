import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function GET(request: Request, { params }: { params: { orderId: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { orderId } = params;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await Order.findById(orderId);
  if (!order || order.transporter?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Order not found or not assigned to you' }, { status: 404 });
  }

  const productIds = (order.products || []).map((p: any) => p.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } });

  return NextResponse.json(
    {
      success: true,
      data: products.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        price: p.price,
        unit: p.unit,
        quantity: p.quantity,
        status: p.status,
      })),
    },
    { status: 200 }
  );
}
