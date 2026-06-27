import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import Product from '@/models/product';
import Order from '@/models/order';
import { verifyToken } from '@/lib/auth';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

async function getAuthUserCompat(request: Request) {
  const strictUser = await getAuthUser(request);
  if (strictUser) return strictUser;

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  return User.findById(decoded.userId);
}

// GET /api/customers
export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUserCompat(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  const isAdmin = ensureActiveRole(user, 'admin') || user.roles?.includes('admin');
  const isAgent = ensureActiveRole(user, 'agent') || user.roles?.includes('agent');
  if (!isAdmin && !isAgent) {
    return NextResponse.json({ success: false, message: 'Admin or agent access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const name = searchParams.get('name');
  const state = searchParams.get('state') || searchParams.get('location');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  const userQuery: any = { roles: 'buyer', status: { $ne: 'removed' } };
  if (search) {
    userQuery.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  if (name) userQuery.name = { $regex: name, $options: 'i' };
  if (state) userQuery.state = { $regex: state, $options: 'i' };
  if (year || month) {
    const createdAt: Record<string, Date> = {};
    const y = year ? Number(year) : undefined;
    const m = month ? Number(month) : undefined;
    if (y && m && m >= 1 && m <= 12) {
      createdAt.$gte = new Date(Date.UTC(y, m - 1, 1));
      createdAt.$lt = new Date(Date.UTC(y, m, 1));
    } else if (y && !Number.isNaN(y)) {
      createdAt.$gte = new Date(Date.UTC(y, 0, 1));
      createdAt.$lt = new Date(Date.UTC(y + 1, 0, 1));
    }
    if (Object.keys(createdAt).length > 0) {
      userQuery.createdAt = createdAt;
    }
  }

  let customers;
  let total;

  if (isAgent && !isAdmin) {
    const productIds = await Product.find({ owner: user._id }).distinct('_id');
    if (productIds.length === 0) {
      customers = [];
      total = 0;
    } else {
      const orders = await Order.find({ 'products.product': { $in: productIds } })
        .select('buyer totalAmount createdAt products')
        .lean();

      const customerStats = new Map<string, { ordersCount: number; totalSpent: number; lastOrderAt: Date | null }>();
      for (const order of orders) {
        const buyerId = order.buyer?.toString?.();
        if (!buyerId) continue;
        const current = customerStats.get(buyerId) || { ordersCount: 0, totalSpent: 0, lastOrderAt: null };
        current.ordersCount += 1;
        current.totalSpent += Number((order as any).totalAmount || 0);
        const orderCreatedAt = (order as any).createdAt ? new Date((order as any).createdAt) : null;
        if (orderCreatedAt && (!current.lastOrderAt || orderCreatedAt > current.lastOrderAt)) {
          current.lastOrderAt = orderCreatedAt;
        }
        customerStats.set(buyerId, current);
      }

      const buyerIds = Array.from(customerStats.keys());
      if (buyerIds.length === 0) {
        customers = [];
        total = 0;
      } else {
        userQuery._id = { $in: buyerIds };
        const [buyerDocs, count] = await Promise.all([
          User.find(userQuery)
            .select('_id name email phone image businessName createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
          User.countDocuments(userQuery)
        ]);
        customers = buyerDocs.map((customer: any) => {
          const stats = customerStats.get(customer._id.toString());
          return {
            ...customer.toObject(),
            ordersCount: stats?.ordersCount || 0,
            totalSpent: stats?.totalSpent || 0,
            lastOrderAt: stats?.lastOrderAt || null
          };
        });
        total = count;
      }
    }
  } else {
    const [customerDocs, count] = await Promise.all([
      User.find(userQuery)
        .select('_id name email phone image businessName createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(userQuery)
    ]);
    customers = customerDocs;
    total = count;
  }

  const pagination = { page, limit, total };
  return NextResponse.json({
    success: true,
    data: { customers, pagination },
    customers,
    pagination
  }, { status: 200 });
}
