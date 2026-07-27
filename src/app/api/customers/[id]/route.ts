import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import Product from '@/models/product';
import Order from '@/models/order';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

function buildCustomerResponse(customer: any, stats?: { ordersCount: number; totalSpent: number; lastOrderAt: Date | null }) {
  const ordersCount = stats?.ordersCount || 0;
  const totalSpent = stats?.totalSpent || 0;
  const lastOrderAt = stats?.lastOrderAt || null;

  return {
    _id: customer._id,
    id: customer._id,
    name: customer.name || customer.businessName || 'Unknown customer',
    fullName: customer.name || customer.businessName || 'Unknown customer',
    email: customer.email || null,
    phone: customer.phone || null,
    mobile: customer.phone || null,
    image: customer.image || null,
    avatar: customer.image || null,
    state: customer.state || null,
    location: customer.state || null,
    address: customer.address || null,
    ordersCount,
    orders: ordersCount,
    totalSpent,
    revenue: totalSpent,
    lastOrderAt,
    createdAt: customer.createdAt || null,
    date: customer.createdAt || null
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const isAdmin = ensureActiveRole(user, 'admin');
  const isAgent = ensureActiveRole(user, 'agent');
  if (!isAdmin && !isAgent) {
    return NextResponse.json({ success: false, message: 'Admin or agent access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid customer id' }, { status: 400 });
  }

  const customer = await User.findById(id)
    .select('_id name email phone image businessName state address createdAt roles status')
    .lean();
  if (!customer || !Array.isArray((customer as any).roles) || !(customer as any).roles.includes('buyer')) {
    return NextResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });
  }

  let stats = { ordersCount: 0, totalSpent: 0, lastOrderAt: null as Date | null };

  if (isAgent) {
    const productIds = await Product.find({ owner: user._id }).distinct('_id');
    if (productIds.length > 0) {
      const orders = await Order.find({ buyer: id, 'products.product': { $in: productIds } })
        .select('totalAmount createdAt')
        .lean();
      stats = {
        ordersCount: orders.length,
        totalSpent: orders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0),
        lastOrderAt: orders.reduce((latest: Date | null, order: any) => {
          const current = order.createdAt ? new Date(order.createdAt) : null;
          if (!current) return latest;
          return !latest || current > latest ? current : latest;
        }, null)
      };
    }
  } else {
    const orders = await Order.find({ buyer: id }).select('totalAmount createdAt').lean();
    stats = {
      ordersCount: orders.length,
      totalSpent: orders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0),
      lastOrderAt: orders.reduce((latest: Date | null, order: any) => {
        const current = order.createdAt ? new Date(order.createdAt) : null;
        if (!current) return latest;
        return !latest || current > latest ? current : latest;
      }, null)
    };
  }

  return NextResponse.json({ success: true, data: buildCustomerResponse(customer, stats) }, { status: 200 });
}
