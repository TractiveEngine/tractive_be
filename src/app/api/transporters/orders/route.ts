import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { getTransporterOrderRows } from '@/lib/transporterPortal';

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
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  const allOrders = await getTransporterOrderRows(user._id.toString(), {
    search,
    status,
    year,
    month
  });
  const total = allOrders.length;
  const start = (page - 1) * limit;

  return NextResponse.json({
    success: true,
    data: allOrders.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }, { status: 200 });
}

