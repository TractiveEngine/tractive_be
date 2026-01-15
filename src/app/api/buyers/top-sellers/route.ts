import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Only buyers can view top sellers' }, { status: 403 });
  }

  const sellerAgg = await Order.aggregate([
    { $unwind: '$products' },
    {
      $lookup: {
        from: 'products',
        localField: 'products.product',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $group: {
        _id: '$productInfo.owner',
        totalSales: { $sum: '$totalAmount' },
        ordersCount: { $sum: 1 }
      }
    },
    { $sort: { totalSales: -1 } },
    { $limit: 10 }
  ]);

  const data = await Promise.all(
    sellerAgg.map(async (s) => {
      const seller = await User.findById(s._id);
      return {
        sellerId: s._id?.toString(),
        name: seller?.name || seller?.businessName || 'Unknown',
        email: seller?.email,
        totalSales: s.totalSales,
        ordersCount: s.ordersCount
      };
    })
  );

  return NextResponse.json({ success: true, data }, { status: 200 });
}
