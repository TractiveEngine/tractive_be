import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import Transaction from '@/models/transaction';
import User from '@/models/user';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/orders/:id/transporters - list available transporters for paid and not-yet-shipped order
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }

  const isBuyer = ensureActiveRole(user, 'buyer');
  const isAgent = ensureActiveRole(user, 'agent');
  const isAdmin = ensureActiveRole(user, 'admin');
  if (!isBuyer && !isAgent && !isAdmin) {
    return NextResponse.json(
      { success: false, message: 'Only buyer, agent, or admin can list transporters for an order' },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, message: 'Invalid order id' }, { status: 400 });
  }

  const order = await Order.findById(id).select('_id buyer status transportStatus transporter totalAmount');
  if (!order) {
    return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
  }

  if (isBuyer && order.buyer.toString() !== user._id.toString()) {
    return NextResponse.json({ success: false, message: 'Not authorized to view this order' }, { status: 403 });
  }

  const paymentInFlight = await Transaction.exists({
    order: order._id,
    status: { $in: ['pending', 'approved'] }
  });

  const hasApprovedPayment = await Transaction.exists({
    order: order._id,
    status: 'approved'
  });

  const isPaid = ['payment_pending', 'paid'].includes(order.status) || !!paymentInFlight;
  const isNotShipped = order.transportStatus === 'pending';
  const paymentPendingApproval =
    order.status === 'payment_pending' || (order.status !== 'paid' && !!paymentInFlight && !hasApprovedPayment);

  if (!isPaid) {
    return NextResponse.json(
      { success: false, message: 'Transporters can be listed only after payment is initiated' },
      { status: 400 }
    );
  }

  if (!isNotShipped) {
    return NextResponse.json(
      { success: false, message: 'Transporters can only be listed before shipping starts' },
      { status: 400 }
    );
  }

  const transporters = await User.find({ roles: 'transporter', status: { $ne: 'removed' } })
    .select('_id name email phone businessName image country state')
    .sort({ createdAt: -1 });

  return NextResponse.json(
    {
      success: true,
      data: {
        orderId: order._id,
        orderStatus: order.status,
        paymentPendingApproval,
        transportStatus: order.transportStatus,
        assignedTransporter: order.transporter || null,
        transporters,
      },
      message: 'Available transporters fetched',
    },
    { status: 200 }
  );
}
