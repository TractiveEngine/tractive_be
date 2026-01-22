import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'agent') && !ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ error: 'Only agents or admins can view farmer orders' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');
  const rangeResult = buildDateRange(yearParam, monthParam);
  if (rangeResult?.error) {
    return NextResponse.json({ error: rangeResult.error }, { status: 400 });
  }

  const farmerId = params.id;
  const orderMatch: Record<string, unknown> = {};
  if (rangeResult?.range) {
    orderMatch.createdAt = rangeResult.range;
  }

  const orderIds = await Order.aggregate([
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
    { $match: { 'productDoc.farmer': farmerId } },
    { $group: { _id: '$_id' } }
  ]);

  const ids = orderIds.map((entry) => entry._id);
  const orders = await Order.find({ _id: { $in: ids } });

  return NextResponse.json({ success: true, data: orders }, { status: 200 });
}
