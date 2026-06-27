import { NextResponse } from 'next/server';
import Product from '@/models/product';
import Order from '@/models/order';
import dbConnect from '@/lib/dbConnect';
import { requireAdmin } from '@/lib/apiAdmin';

export async function GET(request: Request) {
  await dbConnect();
  const { error } = await requireAdmin(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const skip = (page - 1) * limit;
  const search = searchParams.get('search');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  const query: Record<string, any> = {};
  if (status && ['paid', 'delivered', 'pending', 'payment_pending'].includes(status)) {
    query.status = status;
  }
  if (year || month) {
    const createdAt: Record<string, Date> = {};
    const parsedYear = year ? Number(year) : undefined;
    const parsedMonth = month ? Number(month) : undefined;
    if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
      createdAt.$gte = new Date(parsedYear, parsedMonth - 1, 1);
      createdAt.$lt = new Date(parsedYear, parsedMonth, 1);
    } else if (parsedYear) {
      createdAt.$gte = new Date(parsedYear, 0, 1);
      createdAt.$lt = new Date(parsedYear + 1, 0, 1);
    }
    if (Object.keys(createdAt).length > 0) query.createdAt = createdAt;
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('buyer', '_id name businessName phone image state')
      .populate({
        path: 'products.product',
        populate: { path: 'owner', select: '_id name businessName phone image state' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(query)
  ]);

  const filtered = orders.filter((order: any) => {
    const ownerNames = (order.products || []).map((item: any) => item?.product?.owner?.name || item?.product?.owner?.businessName);
    const searchPool = [order._id.toString(), order.buyer?.name, order.buyer?.businessName, ...ownerNames];
    return !search || searchPool.some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));
  });

  return NextResponse.json({
    success: true,
    data: filtered.map((order: any) => ({
      _id: order._id,
      status: order.status,
      transportStatus: order.transportStatus,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      buyer: order.buyer,
      sellers: (order.products || [])
        .map((item: any) => item?.product?.owner)
        .filter(Boolean)
    })),
    pagination: { page, limit, total }
  }, { status: 200 });
}

