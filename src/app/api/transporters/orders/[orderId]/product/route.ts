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

  const fallbackProducts = await Product.find({
    _id: {
      $in: (order.products || []).map((p: any) => p.product?._id || p.product).filter(Boolean),
    },
  });
  const fallbackMap = new Map(fallbackProducts.map((product) => [product._id.toString(), product]));

  const products = (order.products || [])
    .map((line: any) => {
      const populatedProduct = line?.product && line.product._id ? line.product : null;
      const productId = populatedProduct?._id?.toString?.() || line?.product?.toString?.();
      const product = populatedProduct || (productId ? fallbackMap.get(productId) : null);
      if (!product || !productId) return null;

      return {
        id: productId,
        name: product.name,
        price: product.price,
        unit: product.unit,
        quantity: line.quantity,
        orderedQuantity: line.quantity,
        availableQuantity: product.quantity,
        status: product.status,
      };
    })
    .filter(Boolean);

  return NextResponse.json(
    {
      success: true,
      data: products,
    },
    { status: 200 }
  );
}
