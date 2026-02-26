import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/customers
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin') && !ensureActiveRole(user, 'agent')) {
    return NextResponse.json({ success: false, message: 'Admin or agent access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const name = searchParams.get('name');
  const state = searchParams.get('state');
  const year = searchParams.get('year');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  const query: any = { roles: 'buyer', status: { $ne: 'removed' } };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  if (name) query.name = { $regex: name, $options: 'i' };
  if (state) query.state = { $regex: state, $options: 'i' };
  if (year) {
    const y = Number(year);
    if (!Number.isNaN(y)) {
      query.createdAt = {
        $gte: new Date(Date.UTC(y, 0, 1)),
        $lt: new Date(Date.UTC(y + 1, 0, 1))
      };
    }
  }

  const customers = await User.find(query)
    .select('_id name email phone image businessName createdAt')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments(query);

  const pagination = { page, limit, total };
  return NextResponse.json({
    success: true,
    data: { customers, pagination },
    customers,
    pagination
  }, { status: 200 });
}
