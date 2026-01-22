import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Farmer from '@/models/farmer';
import Order from '@/models/order';
import Product from '@/models/product';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

function buildDateRange(yearParam: string | null, monthParam: string | null) {
  if (!yearParam && !monthParam) {
    return undefined;
  }
  const year = yearParam ? Number(yearParam) : NaN;
  const month = monthParam ? Number(monthParam) : NaN;
  if (Number.isNaN(year) || year < 1970) {
    return { error: 'Invalid year filter' };
  }
  if (monthParam && (Number.isNaN(month) || month < 1 || month > 12)) {
    return { error: 'Invalid month filter' };
  }
  if (monthParam && !yearParam) {
    return { error: 'Month filter requires year' };
  }
  if (monthParam) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return { range: { $gte: start, $lt: end } };
  }
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return { range: { $gte: start, $lt: end } };
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ error: 'Only agents or admins can view farmer revenue' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');
  const rangeResult = buildDateRange(yearParam, monthParam);
  if (rangeResult?.error) {
    return NextResponse.json({ error: rangeResult.error }, { status: 400 });
  }

  const farmers = await Farmer.find({ createdBy: user._id }).lean();
  if (!farmers.length) {
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }

  const farmerIds = farmers.map((farmer) => farmer._id);
  const orderMatch: Record<string, unknown> = {};
  if (rangeResult?.range) {
    orderMatch.createdAt = rangeResult.range;
  }

  const stats = await Order.aggregate([
    Object.keys(orderMatch).length ? { $match: orderMatch } : { $match: {} },
    { $unwind: '$products' },
    {
      $lookup: {
        from: Product.collection.name,
        localField: 'products.product',
        foreignField: '_id',
        as: 'productDoc'
      }
    },
    { $unwind: '$productDoc' },
    { $match: { 'productDoc.farmer': { $in: farmerIds } } },
    {
      $group: {
        _id: {
          farmer: '$productDoc.farmer',
          order: '$_id'
        },
        revenue: {
          $sum: { $multiply: ['$productDoc.price', '$products.quantity'] }
        }
      }
    },
    {
      $group: {
        _id: '$_id.farmer',
        revenue: { $sum: '$revenue' },
        ordersCount: { $sum: 1 }
      }
    }
  ]);

  const statsByFarmer = new Map(
    stats.map((entry) => [String(entry._id), entry])
  );

  const data = farmers.map((farmer) => {
    const stat = statsByFarmer.get(String(farmer._id));
    return {
      farmerId: farmer._id,
      name: farmer.name,
      revenue: stat?.revenue ?? 0,
      ordersCount: stat?.ordersCount ?? 0
    };
  });

  return NextResponse.json({ success: true, data }, { status: 200 });
}
