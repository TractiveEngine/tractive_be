import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/user';
import Order from '@/models/order';
import Product from '@/models/product';
import Transaction from '@/models/transaction';
import FleetPayment from '@/models/fleetPayment';
import FleetTrip from '@/models/fleetTrip';
import mongoose from 'mongoose';
import { getAuthUser, ensureActiveRole } from '@/lib/apiAuth';

// GET /api/admin/users/:profession (alias) or /api/admin/users/:id
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  const { id } = await Promise.resolve(params);
  const professions = ['buyer', 'agent', 'transporter', 'admin'];

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    if (professions.includes(id)) {
      const query: any = { roles: id };
      if (status) {
        query.status = status;
      }
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { businessName: { $regex: search, $options: 'i' } }
        ];
      }

      const users = await User.find(query)
        .select('_id name email roles activeRole status businessName phone createdAt isVerified agentApprovalStatus transporterApprovalStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments(query);

      const usersDto = users.map(u => ({
        _id: u._id,
        name: u.name || u.businessName || 'Unknown',
        email: u.email,
        profession: u.roles,
        activeRole: u.activeRole,
        status: u.status || 'active',
        phone: u.phone,
        isVerified: u.isVerified,
        agentApprovalStatus: u.agentApprovalStatus,
        transporterApprovalStatus: u.transporterApprovalStatus,
        createdAt: u.createdAt
      }));

      return NextResponse.json({
        success: true,
        data: {
          users: usersDto,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      }, { status: 200 });
    }

    if (mongoose.Types.ObjectId.isValid(id)) {
      const target = await User.findById(id)
        .select('_id name email roles activeRole status isVerified phone businessName nin businessCAC bankName bankAccountName bankAccountNumber address country state lga villageOrLocalMarket image bio interests agentApprovalStatus transporterApprovalStatus approvalNotes createdAt updatedAt');

      if (!target) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
      }

      const roles = target.roles || [];
      const agentProductIds = roles.includes('agent')
        ? await Product.find({ owner: target._id }).distinct('_id')
        : [];
      const [buyerOrders, buyerTransactions, buyerFleetPayments, ownedProducts, agentOrders, transporterOrders, transporterFleetPayments, transporterTrips, buyerOrdersCount, buyerDeliveredOrdersCount, buyerPaidOrdersCount, buyerApprovedSpendAgg, agentOrdersCount, agentPaidOrdersCount, agentSalesAmountAgg, transporterOrdersCount, transporterDeliveredOrdersCount, transporterFleetPaymentsCount, transporterApprovedRevenueAgg, transporterTripsCount] = await Promise.all([
        roles.includes('buyer')
          ? Order.find({ buyer: target._id })
              .populate('products.product', 'name images owner')
              .sort({ createdAt: -1 })
              .limit(10)
              .lean()
          : Promise.resolve([]),
        roles.includes('buyer')
          ? Transaction.find({ buyer: target._id })
              .populate('order', 'totalAmount status transportStatus createdAt')
              .sort({ createdAt: -1 })
              .limit(10)
              .lean()
          : Promise.resolve([]),
        roles.includes('buyer')
          ? FleetPayment.find({ buyer: target._id })
              .populate('fleet', 'plateNumber fleetName model')
              .sort({ createdAt: -1 })
              .limit(10)
              .lean()
          : Promise.resolve([]),
        roles.includes('agent')
          ? Product.find({ owner: target._id }).select('_id name price unit images').lean()
          : Promise.resolve([]),
        roles.includes('agent')
          ? Order.find({ 'products.product': { $in: agentProductIds } })
              .populate('buyer', 'name email businessName phone')
              .populate('products.product', 'name owner unit images')
              .sort({ createdAt: -1 })
              .limit(20)
              .lean()
          : Promise.resolve([]),
        roles.includes('transporter')
          ? Order.find({ transporter: target._id })
              .populate('buyer', 'name email businessName phone')
              .sort({ createdAt: -1 })
              .limit(10)
              .lean()
          : Promise.resolve([]),
        roles.includes('transporter')
          ? FleetPayment.find({ transporter: target._id })
              .populate('buyer', 'name email businessName phone')
              .populate('fleet', 'plateNumber fleetName model')
              .sort({ createdAt: -1 })
              .limit(10)
              .lean()
          : Promise.resolve([]),
        roles.includes('transporter')
          ? FleetTrip.find({ transporter: target._id })
              .populate('fleet', 'plateNumber fleetName model')
              .sort({ createdAt: -1 })
              .limit(10)
              .lean()
          : Promise.resolve([]),
        roles.includes('buyer')
          ? Order.countDocuments({ buyer: target._id })
          : Promise.resolve(0),
        roles.includes('buyer')
          ? Order.countDocuments({ buyer: target._id, transportStatus: 'delivered' })
          : Promise.resolve(0),
        roles.includes('buyer')
          ? Order.countDocuments({ buyer: target._id, status: 'paid' })
          : Promise.resolve(0),
        roles.includes('buyer')
          ? Transaction.aggregate([
              { $match: { buyer: target._id, status: 'approved' } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
          : Promise.resolve([]),
        roles.includes('agent')
          ? Order.countDocuments({ 'products.product': { $in: agentProductIds } })
          : Promise.resolve(0),
        roles.includes('agent')
          ? Order.countDocuments({ 'products.product': { $in: agentProductIds }, status: { $in: ['paid', 'delivered'] } })
          : Promise.resolve(0),
        roles.includes('agent')
          ? Order.aggregate([
              { $match: { 'products.product': { $in: agentProductIds } } },
              { $unwind: '$products' },
              { $match: { 'products.product': { $in: agentProductIds } } },
              { $group: { _id: null, total: { $sum: { $ifNull: ['$products.lineSubtotal', 0] } } } }
            ])
          : Promise.resolve([]),
        roles.includes('transporter')
          ? Order.countDocuments({ transporter: target._id })
          : Promise.resolve(0),
        roles.includes('transporter')
          ? Order.countDocuments({ transporter: target._id, transportStatus: 'delivered' })
          : Promise.resolve(0),
        roles.includes('transporter')
          ? FleetPayment.countDocuments({ transporter: target._id })
          : Promise.resolve(0),
        roles.includes('transporter')
          ? FleetPayment.aggregate([
              { $match: { transporter: target._id, status: 'approved' } },
              { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
          : Promise.resolve([]),
        roles.includes('transporter')
          ? FleetTrip.countDocuments({ transporter: target._id })
          : Promise.resolve(0)
      ]);

      const ownedProductIds = new Set(ownedProducts.map((product: any) => product._id.toString()));
      const agentSalesLines = agentOrders.flatMap((order: any) =>
        (order.products || [])
          .filter((line: any) => ownedProductIds.has(line?.product?._id?.toString?.() || line?.product?.toString?.()))
          .map((line: any) => ({
            orderId: order._id,
            buyer: order.buyer && typeof order.buyer === 'object'
              ? {
                  _id: order.buyer._id,
                  name: order.buyer.name || order.buyer.businessName || 'Unknown',
                  email: order.buyer.email || null,
                  phone: order.buyer.phone || null
                }
              : null,
            product: line.product && typeof line.product === 'object'
              ? {
                  _id: line.product._id,
                  name: line.product.name || null,
                  unit: line.product.unit || line.unit || null,
                  image: Array.isArray(line.product.images) ? line.product.images[0] || null : null
                }
              : { _id: line.product, name: null, unit: line.unit || null, image: null },
            quantity: line.quantity,
            unit: line.unit || null,
            unitPrice: line.unitPrice ?? null,
            lineSubtotal: line.lineSubtotal ?? null,
            orderStatus: order.status,
            transportStatus: order.transportStatus,
            createdAt: order.createdAt
          }))
      );
      const totalSalesAmount = Number((agentSalesAmountAgg as any[])[0]?.total || 0);
      const approvedTransactionAmount = Number((buyerApprovedSpendAgg as any[])[0]?.total || 0);
      const approvedTransportRevenue = Number((transporterApprovedRevenueAgg as any[])[0]?.total || 0);

      return NextResponse.json({
        success: true,
        data: {
          _id: target._id,
          name: target.name || target.businessName || 'Unknown',
          email: target.email,
          roles: target.roles,
          profession: target.roles,
          activeRole: target.activeRole,
          status: target.status || 'active',
          businessName: target.businessName || null,
          phone: target.phone,
          nin: target.nin || null,
          businessCAC: target.businessCAC || null,
          bankName: target.bankName || null,
          bankAccountName: target.bankAccountName || null,
          bankAccountNumber: target.bankAccountNumber || null,
          address: target.address || null,
          country: target.country || null,
          state: target.state || null,
          lga: target.lga || null,
          villageOrLocalMarket: target.villageOrLocalMarket || null,
          image: target.image || null,
          bio: target.bio || null,
          interests: target.interests || [],
          isVerified: target.isVerified,
          agentApprovalStatus: target.agentApprovalStatus,
          transporterApprovalStatus: target.transporterApprovalStatus,
          approvalNotes: target.approvalNotes || null,
          history: {
            buyer: roles.includes('buyer') ? {
              ordersCount: buyerOrdersCount,
              paidOrdersCount: buyerPaidOrdersCount,
              deliveredOrdersCount: buyerDeliveredOrdersCount,
              totalSpentApproved: approvedTransactionAmount,
              recentOrders: buyerOrders.map((order: any) => ({
                _id: order._id,
                totalAmount: order.totalAmount,
                status: order.status,
                transportStatus: order.transportStatus,
                createdAt: order.createdAt
              })),
              recentTransactions: buyerTransactions.map((tx: any) => ({
                _id: tx._id,
                amount: tx.amount,
                status: tx.status,
                paymentMethod: tx.paymentMethod,
                createdAt: tx.createdAt,
                order: tx.order && typeof tx.order === 'object'
                  ? {
                      _id: tx.order._id,
                      totalAmount: tx.order.totalAmount,
                      status: tx.order.status,
                      transportStatus: tx.order.transportStatus
                    }
                  : tx.order
              })),
              recentTransportPayments: buyerFleetPayments.map((payment: any) => ({
                _id: payment._id,
                amount: payment.amount,
                status: payment.status,
                paymentMethod: payment.paymentMethod,
                loadWeightKg: payment.loadWeightKg,
                createdAt: payment.createdAt,
                fleet: payment.fleet && typeof payment.fleet === 'object'
                  ? {
                      _id: payment.fleet._id,
                      plateNumber: payment.fleet.plateNumber || null,
                      fleetName: payment.fleet.fleetName || null,
                      model: payment.fleet.model || null
                    }
                  : payment.fleet
              }))
            } : null,
            agent: roles.includes('agent') ? {
              productsCount: ownedProducts.length,
              salesCount: agentOrdersCount,
              paidOrdersCount: agentPaidOrdersCount,
              totalSalesAmount,
              recentSales: agentSalesLines.slice(0, 10)
            } : null,
            transporter: roles.includes('transporter') ? {
              assignedOrdersCount: transporterOrdersCount,
              deliveredOrdersCount: transporterDeliveredOrdersCount,
              tripsCount: transporterTripsCount,
              paymentsCount: transporterFleetPaymentsCount,
              approvedTransportRevenue,
              recentTrips: transporterTrips.map((trip: any) => ({
                _id: trip._id,
                trackingCode: trip.trackingCode || null,
                status: trip.status,
                loadWeightKg: trip.loadWeightKg,
                createdAt: trip.createdAt,
                fleet: trip.fleet && typeof trip.fleet === 'object'
                  ? {
                      _id: trip.fleet._id,
                      plateNumber: trip.fleet.plateNumber || null,
                      fleetName: trip.fleet.fleetName || null,
                      model: trip.fleet.model || null
                    }
                  : trip.fleet
              })),
              recentTransportPayments: transporterFleetPayments.map((payment: any) => ({
                _id: payment._id,
                amount: payment.amount,
                status: payment.status,
                paymentMethod: payment.paymentMethod,
                loadWeightKg: payment.loadWeightKg,
                createdAt: payment.createdAt,
                buyer: payment.buyer && typeof payment.buyer === 'object'
                  ? {
                      _id: payment.buyer._id,
                      name: payment.buyer.name || payment.buyer.businessName || 'Unknown',
                      email: payment.buyer.email || null,
                      phone: payment.buyer.phone || null
                    }
                  : payment.buyer
              })),
              recentAssignedOrders: transporterOrders.map((order: any) => ({
                _id: order._id,
                totalAmount: order.totalAmount,
                status: order.status,
                transportStatus: order.transportStatus,
                createdAt: order.createdAt,
                buyer: order.buyer && typeof order.buyer === 'object'
                  ? {
                      _id: order.buyer._id,
                      name: order.buyer.name || order.buyer.businessName || 'Unknown',
                      email: order.buyer.email || null,
                      phone: order.buyer.phone || null
                    }
                  : order.buyer
              }))
            } : null
          },
          createdAt: target.createdAt,
          updatedAt: target.updatedAt
        }
      }, { status: 200 });
    }

    return NextResponse.json({ success: false, message: 'Invalid profession or user id' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching user by profession:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/users/[id] - Update user status or profession
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  await dbConnect();

  const adminUser = await getAuthUser(request);
  if (!adminUser) {
    return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(adminUser, 'admin')) {
    return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
  }

  try {
    const { id } = await Promise.resolve(params);

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid user ID format' 
      }, { status: 400 });
    }

    const { status, profession } = await request.json();

    // Validate status if provided
    if (status && !['active', 'suspended', 'removed'].includes(status)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid status. Must be: active, suspended, or removed' 
      }, { status: 400 });
    }

    // Validate profession if provided
    if (profession && !['buyer', 'agent', 'transporter', 'admin'].includes(profession)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid profession. Must be: buyer, agent, transporter, or admin' 
      }, { status: 400 });
    }

    // Find user
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ 
        success: false, 
        message: 'User not found' 
      }, { status: 404 });
    }

    // Update fields
    if (status) {
      targetUser.status = status;
    }

    if (profession) {
      // Add profession to roles if not already present
      if (!targetUser.roles.includes(profession)) {
        targetUser.roles.push(profession);
      }
      // Set as active role
      targetUser.activeRole = profession;
    }

    await targetUser.save();

    return NextResponse.json({
      success: true,
      data: {
        _id: targetUser._id,
        name: targetUser.name || targetUser.businessName,
        email: targetUser.email,
        roles: targetUser.roles,
        activeRole: targetUser.activeRole,
        status: targetUser.status,
        updatedAt: targetUser.updatedAt
      },
      message: 'User updated successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
}
