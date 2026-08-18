import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import FleetPayment from '@/models/fleetPayment';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

// GET /api/transporters/transactions - Get transporter's transactions
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'transporter')) {
    return NextResponse.json({ error: 'Only transporters can view transactions' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const skip = (page - 1) * limit;

    const orders = await Order.find({ transporter: user._id }).select('_id');
    const orderIds = orders.map(order => order._id);

    const orderTransactionQuery: Record<string, unknown> = {
      order: { $in: orderIds }
    };
    const fleetPaymentQuery: Record<string, unknown> = {
      transporter: user._id
    };
    if (status && ['pending', 'approved', 'rejected', 'refunded'].includes(status)) {
      orderTransactionQuery.status = status;
      fleetPaymentQuery.status = status;
    }

    const [transactions, fleetPayments] = await Promise.all([
      Transaction.find(orderTransactionQuery)
        .populate('buyer', 'name email businessName phone')
        .populate('order')
        .sort({ createdAt: -1 }),
      FleetPayment.find(fleetPaymentQuery)
        .populate('buyer', 'name email businessName phone')
        .populate('fleet', 'plateNumber fleetName fleetNumber model')
        .sort({ createdAt: -1 })
    ]);

    const formattedOrderTransactions = transactions.map(transaction => ({
      _id: transaction._id,
      type: 'order_transaction',
      buyer: {
        id: transaction.buyer._id,
        name: transaction.buyer.name || transaction.buyer.businessName || 'Unknown',
        email: transaction.buyer.email,
        phone: transaction.buyer.phone
      },
      order: {
        id: transaction.order._id,
        totalAmount: transaction.order.totalAmount,
        status: transaction.order.status,
        transportStatus: transaction.order.transportStatus
      },
      amount: transaction.amount,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      approvedBy: transaction.approvedBy,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    }));

    const formattedFleetPayments = fleetPayments.map((payment: any) => ({
      _id: payment._id,
      type: 'fleet_payment',
      buyer: payment.buyer ? {
        id: payment.buyer._id,
        name: payment.buyer.name || payment.buyer.businessName || 'Unknown',
        email: payment.buyer.email,
        phone: payment.buyer.phone
      } : null,
      fleet: payment.fleet ? {
        id: payment.fleet._id,
        plateNumber: payment.fleet.plateNumber,
        fleetName: payment.fleet.fleetName || payment.fleet.fleetNumber || payment.fleet.model || null
      } : null,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      approvedBy: payment.approvedBy,
      loadWeightKg: payment.loadWeightKg ?? null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));

    const mergedTransactions = [...formattedOrderTransactions, ...formattedFleetPayments]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = mergedTransactions.length;
    const pagedTransactions = mergedTransactions.slice(skip, skip + limit);

    return NextResponse.json({ 
      success: true, 
      data: pagedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching transporter transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
