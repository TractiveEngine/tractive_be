import { NextResponse } from 'next/server';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import dbConnect from '@/lib/dbConnect';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ success: false, message: 'Transporter access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const orders = await Order.find({ transporter: user._id }).select('_id').lean();
  const orderIds = orders.map((order: any) => order._id);
  const query: Record<string, unknown> = {
    order: { $in: orderIds },
    status: 'approved'
  };

  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    query.createdAt = { ...(query.createdAt as any), $gte: fromDate };
  }
  if (toDate && !Number.isNaN(toDate.getTime())) {
    query.createdAt = { ...(query.createdAt as any), $lte: toDate };
  }

  const transactions = await Transaction.find(query).sort({ createdAt: 1 }).lean();
  const totalRevenue = transactions.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
  const data = transactions.map((tx: any) => ({
    date: tx.createdAt,
    value: Number(tx.amount || 0)
  }));

  return NextResponse.json({ success: true, data: { totalRevenue, data } }, { status: 200 });
}
