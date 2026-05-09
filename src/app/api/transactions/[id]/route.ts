import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import { createNotification } from '@/lib/notifications';
import { reserveProductInventory } from '@/lib/productInventory';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ error: 'Buyer access required' }, { status: 403 });
  }
  const transaction = await Transaction.findById(id).populate('order');
  if (!transaction || String(transaction.buyer) !== user._id.toString()) {
    return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
  }
  return NextResponse.json({ transaction }, { status: 200 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ error: 'Only admin can approve transactions' }, { status: 403 });
  }

  const transaction = await Transaction.findById(id);
  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  const body = await request.json();
  if (body.status && body.status === 'approved') {
    if (transaction.order) {
      const order = await Order.findById(transaction.order);
      if (order && (!Array.isArray(order.bidIds) || order.bidIds.length === 0)) {
        for (const item of order.products || []) {
          try {
            await reserveProductInventory(item.product, item.quantity);
          } catch (error: any) {
            return NextResponse.json({ error: error?.message || 'Failed to reserve product inventory' }, { status: 400 });
          }
        }
      }
    }

    transaction.status = 'approved';
    transaction.approvedBy = user._id;
    transaction.updatedAt = new Date();
    await transaction.save();

    if (transaction.order) {
      await Order.findByIdAndUpdate(transaction.order, {
        $set: { status: 'paid', updatedAt: new Date() }
      });
    }

    // Notify buyer about transaction approval
    await createNotification({
      userId: transaction.buyer.toString(),
      type: 'transaction_approved',
      title: 'Transaction approved',
      message: `Your transaction of ${transaction.amount} has been approved`,
      metadata: {
        transactionId: transaction._id.toString(),
        amount: transaction.amount,
        orderId: transaction.order?.toString()
      }
    });

    return NextResponse.json({ transaction }, { status: 200 });
  }

  if (body.status && body.status === 'declined') {
    transaction.status = 'pending'; // or add 'declined' to enum
    transaction.updatedAt = new Date();
    await transaction.save();

    if (transaction.order) {
      await Order.findByIdAndUpdate(transaction.order, {
        $set: { status: 'pending', updatedAt: new Date() }
      });
    }

    // Notify buyer about transaction decline
    await createNotification({
      userId: transaction.buyer.toString(),
      type: 'transaction_declined',
      title: 'Transaction declined',
      message: `Your transaction of ${transaction.amount} was declined`,
      metadata: {
        transactionId: transaction._id.toString(),
        amount: transaction.amount
      }
    });

    return NextResponse.json({ transaction }, { status: 200 });
  }

  return NextResponse.json({ error: 'Invalid status or not allowed' }, { status: 400 });
}
