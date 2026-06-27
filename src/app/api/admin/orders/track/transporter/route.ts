import { NextResponse } from 'next/server';
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

  const query: Record<string, any> = {};
  if (status && ['picked', 'on_transit', 'delivered', 'pending'].includes(status)) {
    query.transportStatus = status;
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('buyer', '_id name businessName phone image state')
      .populate('transporter', '_id name businessName phone image state')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(query)
  ]);

  return NextResponse.json({
    success: true,
    data: orders.map((order: any) => ({
      _id: order._id,
      status: order.status,
      transportStatus: order.transportStatus,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      buyer: order.buyer,
      transporter: order.transporter
    })),
    pagination: { page, limit, total }
  }, { status: 200 });
}

