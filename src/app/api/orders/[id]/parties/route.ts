import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import Product from '@/models/product';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import mongoose from 'mongoose';

function userDto(u: any) {
  if (!u) return null;
  return {
    id: u._id?.toString(),
    name: u.name || u.businessName || '',
    email: u.email,
    phone: u.phone,
  };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await Order.findById(id).populate('products.product');
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  const sellerIds = (order.products || [])
    .map((p: any) => p?.product?.owner?.toString?.())
    .filter(Boolean);

  const isBuyer = ensureActiveRole(user, 'buyer') && order.buyer?.toString() === user._id.toString();
  const isSeller = ensureActiveRole(user, 'agent') && sellerIds.includes(user._id.toString());
  const isTransporter = ensureActiveRole(user, 'transporter') && order.transporter?.toString() === user._id.toString();
  const isAdmin = ensureActiveRole(user, 'admin');

  if (!isBuyer && !isSeller && !isTransporter && !isAdmin) {
    return NextResponse.json({ success: false, message: 'Not authorized to view this order' }, { status: 403 });
  }

  const buyerUser = await User.findById(order.buyer);

  // pick first seller from first product owner
  const firstProductOwnerId = sellerIds[0];
  const sellerUser = firstProductOwnerId ? await User.findById(firstProductOwnerId) : null;
  const transporterUser = order.transporter ? await User.findById(order.transporter) : null;

  return NextResponse.json(
    {
      success: true,
      data: {
        buyer: userDto(buyerUser),
        seller: userDto(sellerUser),
        transporter: userDto(transporterUser),
      },
    },
    { status: 200 }
  );
}
