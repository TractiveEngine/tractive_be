import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/transaction';
import Order from '@/models/order';
import Product from '@/models/product';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';

// GET /api/admin/transactions - List all transactions with filters
export async function GET(request: Request) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    
    // Query parameters
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    
    if (status) {
      query.status = status;
    }
    
    if (method) {
      query.paymentMethod = method;
    }
    
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        query.createdAt.$lte = new Date(toDate);
      }
    }

    // Get transactions
    const transactions = await Transaction.find(query)
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
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments(query);

    // Format response
    const transactionsDto = transactions.map((t: any) => {
      const buyer = t?.buyer && typeof t.buyer === 'object' ? t.buyer : null;
      const order = t?.order && typeof t.order === 'object' ? t.order : null;
      const approvedBy = t?.approvedBy && typeof t.approvedBy === 'object' ? t.approvedBy : null;
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
      const products = (order?.products || [])
        .map((item: any) => {
          const product = item?.product && typeof item.product === 'object' ? item.product : null;
          if (!product?._id) return null;
          const owner = product.owner && typeof product.owner === 'object' ? product.owner : null;
          return {
            id: product._id,
            name: product.name || null,
            description: product.description || null,
            images: Array.isArray(product.images) ? product.images : [],
            videos: Array.isArray(product.videos) ? product.videos : [],
            price: product.price ?? null,
            quantity: item.quantity ?? null,
            unit: item.unit ?? product.unit ?? null,
            unitWeightKg: item.unitWeightKg ?? product.unitWeightKg ?? null,
            unitPrice: item.unitPrice ?? null,
            lineSubtotal: item.lineSubtotal ?? null,
            owner: owner ? {
              id: owner._id,
              name: owner.name || owner.businessName || 'Unknown',
              email: owner.email || null
            } : null
          };
        })
        .filter(Boolean);

      return {
        _id: t._id,
        amount: t.amount,
        status: t.status,
        method: t.paymentMethod,
        refundReason: t.refundReason ?? null,
        payer: {
          id: buyer?._id || null,
          name: buyer?.name || buyer?.businessName || 'Unknown',
          email: buyer?.email || null
        },
        payee: payees[0] || null,
        payees,
        orderId: order?._id || null,
        products,
        approvedBy: approvedBy ? {
          id: approvedBy._id,
          name: approvedBy.name || approvedBy.email
        } : null,
        createdAt: t.createdAt
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        transactions: transactionsDto,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
