import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/order';
import Product from '@/models/product';
import Bid from '@/models/bid';
import FleetTrip from '@/models/fleetTrip';
import '@/models/truck';
import '@/models/user';
import { createNotification } from '@/lib/notifications';
import { ensureActiveRole, getAuthUser } from '@/lib/apiAuth';
import { buildOrderItemLocalTransport } from '@/lib/localTransport';
import { getEffectiveProductBidAmount } from '@/lib/productBidAmount';
import { getUnitWeightKg } from '@/lib/productUnit';
import {
  buildFleetSummaryForOrder,
  buildOrderOwnerSummary,
  buildOrderPaymentMethodMap,
  computeEstimatedDeliveryDate,
  buildTrackingSummaryFromEvents,
  buildTransporterStatsMap,
  buildTransporterSummaryForOrder,
  buildTripTimelineMap
} from '@/lib/orderView';

export async function POST(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ensureActiveRole(user, 'buyer')) {
    return NextResponse.json({ error: 'Buyer access required' }, { status: 403 });
  }

  const { products, totalAmount, address, transportStatus, bidIds } = await request.json();
  if (!products || !Array.isArray(products) || products.length === 0 || !totalAmount) {
    return NextResponse.json({ error: 'Products and totalAmount required' }, { status: 400 });
  }

  const idempotencyKey = request.headers.get('Idempotency-Key') || request.headers.get('idempotency-key');
  if (idempotencyKey) {
    const existingByKey = await Order.findOne({ buyer: user._id, idempotencyKey });
    if (existingByKey) {
      return NextResponse.json({
        success: true,
        data: existingByKey,
        message: 'Existing order returned for idempotency key'
      }, { status: 200 });
    }
  }

  const normalizeProducts = products
    .map((item: any) => ({
      product: item.product?.toString?.() ?? String(item.product),
      quantity: Number(item.quantity)
    }))
    .sort((a: any, b: any) => (a.product > b.product ? 1 : -1));
  const normalizedBidIds = Array.isArray(bidIds)
    ? bidIds.map((id: any) => String(id)).sort()
    : [];
  const orderSignature = JSON.stringify({ products: normalizeProducts, bidIds: normalizedBidIds });

  const existingPending = await Order.findOne({
    buyer: user._id,
    status: { $in: ['pending', 'payment_pending'] },
    orderSignature
  });
  if (existingPending) {
    return NextResponse.json({
      success: true,
      data: existingPending,
      message: 'Existing pending order returned'
    }, { status: 200 });
  }

  const productIds = products.map((p: any) => p.product);
  const productDocs = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(productDocs.map((product: any) => [product._id.toString(), product]));
  const missingProducts = productIds.filter((id: string) => !productMap.has(String(id)));
  if (missingProducts.length > 0) {
    return NextResponse.json({ error: 'One or more products not found' }, { status: 400 });
  }

  const orderProducts = products.map((item: any) => {
    const productId = item.product?.toString?.() ?? String(item.product);
    const productDoc: any = productMap.get(productId);
    const quantity = Number(item.quantity);
    const localTransportMeta = buildOrderItemLocalTransport(productDoc);
    const unitPrice = Number(productDoc.price || 0);
    return {
      product: productDoc._id,
      quantity,
      unit: productDoc.unit,
      unitWeightKg: productDoc.unitWeightKg ?? getUnitWeightKg(productDoc.unit),
      unitPrice,
      lineSubtotal: unitPrice * quantity,
      ...localTransportMeta
    };
  });
  const localTransportTotal = orderProducts.reduce((sum, item) => sum + (item.localTransportFee || 0), 0);

  if (Array.isArray(bidIds) && bidIds.length > 0) {
    const bids = await Bid.find({ _id: { $in: bidIds }, buyer: user._id });
    const missing = bidIds.filter((id: string) => !bids.some((b) => b._id.toString() === id));
    if (missing.length > 0) {
      return NextResponse.json({ error: 'One or more bids not found for buyer' }, { status: 400 });
    }
    const invalidStatus = bids.find((bid) => bid.status !== 'accepted');
    if (invalidStatus) {
      return NextResponse.json({ error: 'All bids must be accepted before creating an order' }, { status: 400 });
    }
    const bidProductIds = bids.map((bid: any) => bid.product?.toString?.() ?? String(bid.product)).sort();
    const requestProductIds = orderProducts.map((item) => item.product.toString()).sort();
    if (JSON.stringify(bidProductIds) !== JSON.stringify(requestProductIds)) {
      return NextResponse.json({ error: 'Products must match the selected accepted bids' }, { status: 400 });
    }
    const bidMap = new Map(bids.map((bid: any) => [bid.product.toString(), bid]));
    for (const item of orderProducts) {
      const bid: any = bidMap.get(item.product.toString());
      if (!bid || Number(bid.quantity) !== Number(item.quantity)) {
        return NextResponse.json({ error: 'Order quantities must match the selected accepted bids' }, { status: 400 });
      }
      item.unit = bid.unit;
      item.unitWeightKg = bid.unitWeightKg ?? getUnitWeightKg(bid.unit);
      item.unitPrice = Number(bid.quantity) > 0 ? getEffectiveProductBidAmount(bid) / Number(bid.quantity) : null;
      item.lineSubtotal = getEffectiveProductBidAmount(bid);
    }
    const expectedTotal = bids.reduce((sum, bid) => sum + getEffectiveProductBidAmount(bid), 0) + localTransportTotal;
    if (Number(totalAmount) !== expectedTotal) {
      return NextResponse.json({ error: 'Total amount does not match accepted bids' }, { status: 400 });
    }
  } else {
    for (const item of orderProducts) {
      const productDoc: any = productMap.get(item.product.toString());
      if (productDoc.status !== 'available' || Number(item.quantity) > Number(productDoc.quantity || 0)) {
        return NextResponse.json({ error: 'One or more products exceed available stock' }, { status: 400 });
      }
    }
    const expectedTotal = orderProducts.reduce((sum, item) => sum + (item.lineSubtotal || 0), 0) + localTransportTotal;
    if (Number(totalAmount) !== expectedTotal) {
      return NextResponse.json({ error: 'Total amount does not match products and local transport' }, { status: 400 });
    }
  }

  const order = await Order.create({
    buyer: user._id,
    products: orderProducts,
    bidIds: Array.isArray(bidIds) ? bidIds : [],
    totalAmount,
    address,
    status: 'pending',
    transportStatus: transportStatus || 'pending',
    idempotencyKey: idempotencyKey || undefined,
    orderSignature
  });

  // Notify buyer about order creation
  await createNotification({
    userId: user._id.toString(),
    type: 'order_created',
    title: 'Order created successfully',
    message: `Your order of ${totalAmount} has been created`,
    metadata: {
      orderId: order._id.toString(),
      totalAmount,
      productsCount: products.length
    }
  });

  // Notify sellers/agents about new order
  const sellerIds = [...new Set(productDocs.map(p => p.owner.toString()))];
  
  for (const sellerId of sellerIds) {
    await createNotification({
      userId: sellerId,
      type: 'order_created',
      title: 'New order received',
      message: `You have a new order for ${totalAmount}`,
      metadata: {
        orderId: order._id.toString(),
        totalAmount,
        buyerName: user.name || user.email
      }
    });
  }

  return NextResponse.json({ order }, { status: 201 });
}

export async function GET(request: Request) {
  await dbConnect();
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');
  const status = searchParams.get('status');
  const transportStatus = searchParams.get('transportStatus');
  const readyForTransport = searchParams.get('readyForTransport');
  const buyerId = searchParams.get('buyerId');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const skip = (page - 1) * limit;
  const query: Record<string, unknown> = {};

  if (ensureActiveRole(user, 'buyer')) {
    query.buyer = user._id;
  } else if (ensureActiveRole(user, 'agent')) {
    const productIds = await Product.find({ owner: user._id }).distinct('_id');
    if (productIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0 }
      }, { status: 200 });
    }
    query['products.product'] = { $in: productIds };
  } else if (ensureActiveRole(user, 'admin')) {
    if (buyerId) query.buyer = buyerId;
  } else {
    return NextResponse.json({ error: 'Buyer, agent, or admin access required' }, { status: 403 });
  }

  if (status && ['pending', 'payment_pending', 'paid', 'delivered'].includes(status)) {
    query.status = status;
  }
  if (transportStatus && ['pending', 'picked', 'on_transit', 'delivered'].includes(transportStatus)) {
    query.transportStatus = transportStatus;
  }
  if (readyForTransport === 'true') {
    query.status = 'paid';
    query.transportStatus = 'pending';
  }
  if (year || month) {
    const createdAt: Record<string, Date> = {};
    const parsedYear = year ? Number(year) : undefined;
    const parsedMonth = month ? Number(month) : undefined;
    if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
      createdAt.$gte = new Date(parsedYear, parsedMonth - 1, 1);
      createdAt.$lt = new Date(parsedYear, parsedMonth, 1);
    } else if (parsedYear) {
      createdAt.$gte = new Date(parsedYear, 0, 1);
      createdAt.$lt = new Date(parsedYear + 1, 0, 1);
    }
    if (Object.keys(createdAt).length > 0) query.createdAt = createdAt;
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate({
        path: 'products.product',
        populate: { path: 'owner', select: '_id name businessName image' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(query)
  ]);

  const orderIds = orders.map((order: any) => order._id.toString());
  const tripIds = Array.from(new Set(
    orders.map((order: any) => order.fleetTripId?.toString?.()).filter(Boolean)
  ));
  const paymentMethodMap = await buildOrderPaymentMethodMap(orderIds);
  const tripTimelineMap = await buildTripTimelineMap(tripIds);
  const trips = tripIds.length > 0
    ? await FleetTrip.find({ _id: { $in: tripIds } })
        .populate('fleet', '_id plateNumber fleetName fleetNumber iot tracker model images estimatedDeliveryValue estimatedDeliveryUnit')
        .populate('transporter', '_id name businessName phone image address state createdAt')
        .lean()
    : [];
  const tripMap = new Map(trips.map((trip: any) => [trip._id.toString(), trip]));
  const transporterIds = Array.from(new Set(
    trips.map((trip: any) => trip.transporter?._id?.toString?.() || trip.transporter?.toString?.()).filter(Boolean)
  ));
  const transporterStatsMap = await buildTransporterStatsMap(transporterIds);

  const normalizedOrders = orders.map((order: any) => {
    const orderObj = order.toObject();
    const tripId = orderObj.fleetTripId?.toString?.() || null;
    const trip = tripId ? tripMap.get(tripId) : null;
    const transporter = trip?.transporter && typeof trip.transporter === 'object' ? trip.transporter : null;
    const fleet = trip?.fleet && typeof trip.fleet === 'object' ? trip.fleet : null;
    const transporterId = transporter?._id?.toString?.() || null;
    const trackingSummary = buildTrackingSummaryFromEvents(
      tripId ? (tripTimelineMap.get(tripId) || []) : [],
      { estDeliveryDate: computeEstimatedDeliveryDate(trip) }
    );

    return {
      ...orderObj,
      products: (orderObj.products || []).map((item: any) => ({
        ...item,
        product: item.product && typeof item.product === 'object'
          ? {
              ...item.product,
              owner: buildOrderOwnerSummary(item.product.owner)
            }
          : item.product
      })),
      paymentMethod: paymentMethodMap.get(orderObj._id.toString()) || null,
      transporter: buildTransporterSummaryForOrder(transporter, transporterId ? transporterStatsMap.get(transporterId) : null),
      fleet: buildFleetSummaryForOrder(fleet),
      trackingCode: trip?.trackingCode || null,
      currentLocation: {
        lat: trip?.currentLatitude ?? null,
        lng: trip?.currentLongitude ?? null,
        label: trip?.currentLocation || ''
      },
      currentLocationLabel: trip?.currentLocation || '',
      ...trackingSummary
    };
  });

  return NextResponse.json({
    success: true,
    data: normalizedOrders,
    pagination: { page, limit, total }
  }, { status: 200 });
}
