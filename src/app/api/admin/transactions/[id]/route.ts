import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import Product from '@/models/product';
import mongoose from 'mongoose';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid transaction id' }, { status: 400 });
  }

  const transaction = await Transaction.findById(id)
    .populate('buyer', 'name email businessName')
    .populate({
      path: 'order',
      model: Order,
      populate: {
        path: 'products.product',
        model: Product,
        populate: {
          path: 'owner',
          select: 'name email businessName'
        }
      }
    })
    .populate('approvedBy', 'name email');

  if (!transaction) {
    return NextResponse.json({ success: false, message: 'Transaction not found' }, { status: 404 });
  }

  const buyer = transaction?.buyer && typeof transaction.buyer === 'object' ? transaction.buyer : null;
  const order = transaction?.order && typeof transaction.order === 'object' ? transaction.order : null;
  const approvedBy = transaction?.approvedBy && typeof transaction.approvedBy === 'object' ? transaction.approvedBy : null;
  const payees = Array.from(
    new Map(
      (order?.products || [])
        .map((item: any) => item?.product?.owner)
        .filter((owner: any) => owner && typeof owner === 'object' && owner._id)
        .map((owner: any) => [
          owner._id.toString(),
          {
            id: owner._id,
            name: owner.name || owner.businessName || 'Unknown',
            email: owner.email || null
          }
        ])
    ).values()
  );

  return NextResponse.json({
    success: true,
    data: {
      _id: transaction._id,
      amount: transaction.amount,
      status: transaction.status,
      method: transaction.paymentMethod,
      payer: {
        id: buyer?._id || null,
        name: buyer?.name || buyer?.businessName || 'Unknown',
        email: buyer?.email || null
      },
      payee: payees[0] || null,
      payees,
      orderId: order?._id || null,
      order,
      approvedBy: approvedBy ? {
        id: approvedBy._id,
        name: approvedBy.name || approvedBy.email,
        email: approvedBy.email || null
      } : null,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    }
  }, { status: 200 });
}
