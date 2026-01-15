import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Product from '@/models/product';
import User from '@/models/user';

// GET /api/sellers - list sellers (agents with products)
export async function GET(request: Request) {
  await dbConnect();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const skip = (page - 1) * limit;

  const ownerAgg = await Product.aggregate([
    { $group: { _id: '$owner', productsCount: { $sum: 1 } } },
    { $sort: { productsCount: -1 } },
    { $skip: skip },
    { $limit: limit }
  ]);

  const total = await Product.distinct('owner').then((owners) => owners.length);

  const sellers = await Promise.all(
    ownerAgg.map(async (o) => {
      const seller = await User.findById(o._id);
      return {
        sellerId: o._id?.toString(),
        name: seller?.name || seller?.businessName || 'Unknown',
        email: seller?.email,
        productsCount: o.productsCount,
        roles: seller?.roles,
        activeRole: seller?.activeRole
      };
    })
  );

  return NextResponse.json(
    {
      success: true,
      data: sellers,
      pagination: { page, limit, total }
    },
    { status: 200 }
  );
}
