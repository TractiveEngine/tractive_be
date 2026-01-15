import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can view top selling products' }, { status: 403 });
  }

  const productAgg = await Order.aggregate([
    { $unwind: '$products' },
    {
      $group: {
        _id: '$products.product',
        ordersCount: { $sum: 1 },
        totalQuantity: { $sum: '$products.quantity' },
        totalAmount: { $sum: '$totalAmount' }
      }
    },
    { $sort: { ordersCount: -1 } },
    { $limit: 10 }
  ]);

  const data = await Promise.all(
    productAgg.map(async (p) => {
      const product = await Product.findById(p._id);
      return {
        productId: p._id?.toString(),
        name: product?.name || 'Unknown',
        ordersCount: p.ordersCount,
        totalQuantity: p.totalQuantity,
        totalAmount: p.totalAmount,
        price: product?.price,
        unit: product?.unit
      };
    })
  );

  return NextResponse.json({ success: true, data }, { status: 200 });
}
