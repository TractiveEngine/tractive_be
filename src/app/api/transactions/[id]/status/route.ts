import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import Product from '@/models/product';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';
import { createNotification } from '@/lib/notifications';
import mongoose from 'mongoose';

const ALLOWED_STATUS = ['approved', 'rejected', 'pending'] as const;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  const { id } = params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transaction id' }, { status: 400 });
  }

  const tx = await Transaction.findById(id);
  if (!tx) {
    return NextResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 });
  }

  const body: any = await request.json().catch(() => ({}));
  const status = body?.status;
  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
  }

  tx.status = status;
  tx.approvedBy = user._id;
  tx.updatedAt = new Date();
  await tx.save();

  // Update order status on approval/rejection
  if (tx.order) {
    const order = await Order.findById(tx.order);
    if (order) {
      if (status === 'approved') order.status = 'paid';
      if (status === 'rejected') order.status = 'pending';
      order.updatedAt = new Date();
      await order.save();
    }
  }

  // Notify buyer
  const notifType = status === 'approved' ? 'transaction_approved' : status === 'rejected' ? 'transaction_declined' : 'generic';

  await createNotification({
    userId: tx.buyer.toString(),
    type: notifType,
    title: 'Transaction update',
    message: `Your transaction status is now ${status}`,
    metadata: { transactionId: tx._id.toString(), status },
  });

  // Notify seller/agent from linked order products
  if (tx.order) {
    const order = await Order.findById(tx.order).populate('products.product');
    const sellerIds = (order?.products || [])
      .map((p: any) => p?.product?.owner?.toString?.())
      .filter(Boolean);
    for (const sellerId of new Set(sellerIds)) {
      await createNotification({
        userId: sellerId,
        type: notifType,
        title: 'Order transaction update',
        message: `Transaction for your order is now ${status}`,
        metadata: { transactionId: tx._id.toString(), status, orderId: tx.order?.toString() },
      });
    }
    if (order?.transporter) {
      await createNotification({
        userId: order.transporter.toString(),
        type: notifType,
        title: 'Order transaction update',
        message: `Transaction linked to your delivery is now ${status}`,
        metadata: { transactionId: tx._id.toString(), status, orderId: tx.order?.toString() },
      });
    }
  }

  return NextResponse.json({ success: true, data: tx }, { status: 200 });
}
