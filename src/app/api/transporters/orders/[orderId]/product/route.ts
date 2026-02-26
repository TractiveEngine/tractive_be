import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user || !ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const resolvedParams = await Promise.resolve(params);
  const { orderId } = resolvedParams;
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await Order.findById(orderId).populate('products.product');
  if (!order || order.transporter?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Order not found or not assigned to you' }, { status: 404 });
  }

  const embeddedProducts = (order.products || [])
    .map((p: any) => p?.product)
    .filter((p: any) => p && p._id);

  const products =
    embeddedProducts.length > 0
      ? embeddedProducts
      : await Product.find({
          _id: {
            $in: (order.products || []).map((p: any) => p.product).filter(Boolean),
          },
        });

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
