import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import Transaction from '@/models/transaction';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ success: false, message: 'Buyer access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await Order.findById(id).populate({
    path: 'products.product',
    populate: { path: 'owner', select: '_id name businessName image email phone' }
  });
  if (!order || order.buyer?.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  const transaction = await Transaction.findOne({ order: order._id }).sort({ updatedAt: -1, createdAt: -1 });
  const orderObj: any = order.toObject();

  return NextResponse.json({
    success: true,
    data: {
      orderId: order._id.toString(),
      status: order.status,
      transportStatus: order.transportStatus,
      totalAmount: order.totalAmount,
      address: order.address || '',
      createdAt: order.createdAt,
      paymentMethod: transaction?.paymentMethod || null,
      transactionStatus: transaction?.status || null,
      products: (orderObj.products || []).map((item: any) => ({
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineSubtotal: item.lineSubtotal,
        product: item.product && typeof item.product === 'object'
          ? {
              _id: item.product._id,
              name: item.product.name || null,
              image: Array.isArray(item.product.images) ? item.product.images[0] || null : null,
              owner: item.product.owner && typeof item.product.owner === 'object'
                ? {
                    _id: item.product.owner._id,
                    name: item.product.owner.name || null,
                    businessName: item.product.owner.businessName || null,
                    image: item.product.owner.image || null,
                    email: item.product.owner.email || null,
                    phone: item.product.owner.phone || null
                  }
                : null
            }
          : item.product
      }))
    }
  }, { status: 200 });
}
