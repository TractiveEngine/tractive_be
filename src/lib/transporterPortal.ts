import FleetBooking from '@/models/fleetBooking';
import FleetTrip from '@/models/fleetTrip';
import FleetTripTrackingEvent from '@/models/fleetTripTrackingEvent';
import Order from '@/models/order';
import Review from '@/models/review';
import Transaction from '@/models/transaction';
import Truck from '@/models/truck';
import User from '@/models/user';
import Driver from '@/models/driver';
import {
  buildFleetSummaryForOrder,
  buildOrderOwnerSummary,
  buildOrderPaymentMethodMap,
  buildTrackingSummaryFromEvents,
  buildTransporterStatsMap,
  buildTransporterSummaryForOrder,
  buildTripTimelineMap,
  computeEstimatedDeliveryDate
} from '@/lib/orderView';

export function buildDateRange(year: string | null, month: string | null) {
  const parsedYear = year ? Number(year) : undefined;
  const parsedMonth = month ? Number(month) : undefined;
  const createdAt: Record<string, Date> = {};

  if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
    createdAt.$gte = new Date(parsedYear, parsedMonth - 1, 1);
    createdAt.$lt = new Date(parsedYear, parsedMonth, 1);
  } else if (parsedYear) {
    createdAt.$gte = new Date(parsedYear, 0, 1);
    createdAt.$lt = new Date(parsedYear + 1, 0, 1);
  }

  return Object.keys(createdAt).length > 0 ? createdAt : null;
}

function safeDate(value: unknown) {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesSearch(values: unknown[], search: string | null) {
  if (!search) return true;
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return values.some((value) => String(value || '').toLowerCase().includes(term));
}

export async function getTransporterCustomerSummaries(
  transporterId: string,
  options: {
    search?: string | null;
    year?: string | null;
    month?: string | null;
  } = {}
) {
  const createdAt = buildDateRange(options.year || null, options.month || null);
  const orderQuery: Record<string, unknown> = { transporter: transporterId };
  const bookingQuery: Record<string, unknown> = {
    transporter: transporterId,
    status: { $in: ['confirmed', 'completed'] }
  };
  const tripQuery: Record<string, unknown> = { transporter: transporterId };

  if (createdAt) {
    orderQuery.createdAt = createdAt;
    bookingQuery.createdAt = createdAt;
    tripQuery.createdAt = createdAt;
  }

  const [orders, bookings, trips] = await Promise.all([
    Order.find(orderQuery)
      .populate('buyer', '_id name businessName email phone image state address createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    FleetBooking.find(bookingQuery)
      .populate('buyer', '_id name businessName email phone image state address createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    FleetTrip.find(tripQuery)
      .populate('buyerIds', '_id name businessName email phone image state address createdAt')
      .sort({ createdAt: -1 })
      .lean()
  ]);

  const rows = new Map<string, any>();
  const ensureRow = (buyer: any) => {
    if (!buyer?._id) return null;
    const id = buyer._id.toString();
    if (!rows.has(id)) {
      rows.set(id, {
        id,
        name: buyer.name || buyer.businessName || 'Unknown customer',
        businessName: buyer.businessName || null,
        email: buyer.email || null,
        image: buyer.image || null,
        state: buyer.state || null,
        mobile: buyer.phone || null,
        phone: buyer.phone || null,
        address: buyer.address || null,
        orders: 0,
        revenue: 0,
        date: null as Date | null,
        bookingCount: 0,
        tripCount: 0
      });
    }
    return rows.get(id);
  };

  for (const order of orders) {
    const row = ensureRow((order as any).buyer);
    if (!row) continue;
    row.orders += 1;
    row.revenue += Number((order as any).totalAmount || 0);
    const created = safeDate((order as any).createdAt);
    if (created && (!row.date || created > row.date)) row.date = created;
  }

  for (const booking of bookings) {
    const row = ensureRow((booking as any).buyer);
    if (!row) continue;
    row.bookingCount += 1;
    row.revenue += Number((booking as any).amount || 0);
    const created = safeDate((booking as any).createdAt);
    if (created && (!row.date || created > row.date)) row.date = created;
  }

  for (const trip of trips) {
    for (const buyer of (trip as any).buyerIds || []) {
      const row = ensureRow(buyer);
      if (!row) continue;
      row.tripCount += 1;
      const created = safeDate((trip as any).createdAt);
      if (created && (!row.date || created > row.date)) row.date = created;
    }
  }

  return Array.from(rows.values())
    .filter((row) =>
      matchesSearch(
        [row.name, row.businessName, row.email, row.state, row.mobile, row.address],
        options.search || null
      )
    )
    .sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    })
    .map((row) => ({
      ...row,
      date: row.date ? new Date(row.date).toISOString() : null
    }));
}

export async function getTransporterCustomerDetail(transporterId: string, customerId: string) {
  const [customer, orders, bookings, trips, transactions] = await Promise.all([
    User.findById(customerId)
      .select('_id name businessName email phone image state address country createdAt')
      .lean(),
    Order.find({ transporter: transporterId, buyer: customerId })
      .populate({
        path: 'products.product',
        populate: { path: 'owner', select: '_id name businessName image' }
      })
      .sort({ createdAt: -1 })
      .lean(),
    FleetBooking.find({ transporter: transporterId, buyer: customerId })
      .sort({ createdAt: -1 })
      .lean(),
    FleetTrip.find({ transporter: transporterId, buyerIds: customerId })
      .sort({ createdAt: -1 })
      .lean(),
    Transaction.find({ buyer: customerId }).sort({ createdAt: -1 }).lean()
  ]);

  if (!customer) return null;

  const orderIds = orders.map((order: any) => order._id.toString());
  const paidTransactionMap = new Map(
    transactions
      .filter((tx: any) => tx.order)
      .map((tx: any) => [tx.order.toString(), tx])
  );

  return {
    id: customer._id.toString(),
    name: customer.name || customer.businessName || 'Unknown customer',
    businessName: customer.businessName || null,
    email: customer.email || null,
    image: customer.image || null,
    state: customer.state || null,
    mobile: customer.phone || null,
    phone: customer.phone || null,
    address: customer.address || null,
    country: customer.country || null,
    createdAt: customer.createdAt || null,
    ordersCount: orders.length,
    bookingsCount: bookings.length,
    tripsCount: trips.length,
    revenue: orders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0) +
      bookings.reduce((sum: number, booking: any) => sum + Number(booking.amount || 0), 0),
    recentOrders: orders.slice(0, 10).map((order: any) => ({
      _id: order._id,
      status: order.status,
      transportStatus: order.transportStatus,
      totalAmount: order.totalAmount,
      paymentMethod: paidTransactionMap.get(order._id.toString())?.paymentMethod || null,
      createdAt: order.createdAt,
      products: (order.products || []).map((item: any) => ({
        ...item,
        product: item.product && typeof item.product === 'object'
          ? {
              ...item.product,
              owner: buildOrderOwnerSummary(item.product.owner)
            }
          : item.product
      }))
    })),
    recentBookings: bookings.slice(0, 10),
    recentTrips: trips.slice(0, 10)
  };
}

export async function getTransporterOrderRows(
  transporterId: string,
  options: {
    search?: string | null;
    status?: string | null;
    year?: string | null;
    month?: string | null;
  } = {}
) {
  const createdAt = buildDateRange(options.year || null, options.month || null);
  const query: Record<string, unknown> = { transporter: transporterId };

  const statusMap: Record<string, string> = {
    new: 'pending',
    picked: 'picked',
    on_transit: 'on_transit',
    delivered: 'delivered'
  };
  const mappedStatus = options.status ? statusMap[options.status] || options.status : null;
  if (mappedStatus && ['pending', 'picked', 'on_transit', 'delivered'].includes(mappedStatus)) {
    query.transportStatus = mappedStatus;
  }
  if (createdAt) {
    query.createdAt = createdAt;
  }

  const orders = await Order.find(query)
    .populate('buyer', '_id name businessName email phone image state address createdAt')
    .populate({
      path: 'products.product',
      populate: { path: 'owner', select: '_id name businessName image' }
    })
    .sort({ createdAt: -1 })
    .lean();

  const orderIds = orders.map((order: any) => order._id.toString());
  const tripIds = Array.from(new Set(orders.map((order: any) => order.fleetTripId?.toString?.()).filter(Boolean)));
  const paymentMethodMap = await buildOrderPaymentMethodMap(orderIds);
  const tripTimelineMap = await buildTripTimelineMap(tripIds);
  const trips = tripIds.length > 0
    ? await FleetTrip.find({ _id: { $in: tripIds } })
        .populate('fleet', '_id plateNumber fleetName fleetNumber iot tracker model images route estimatedDeliveryValue estimatedDeliveryUnit')
        .populate('transporter', '_id name businessName phone image address state createdAt')
        .lean()
    : [];
  const tripMap = new Map(trips.map((trip: any) => [trip._id.toString(), trip]));
  const transporterStatsMap = await buildTransporterStatsMap([transporterId]);

  return orders
    .map((order: any) => {
      const tripId = order.fleetTripId?.toString?.() || null;
      const trip = tripId ? tripMap.get(tripId) : null;
      const transporter = trip?.transporter && typeof trip.transporter === 'object' ? trip.transporter : null;
      const fleet = trip?.fleet && typeof trip.fleet === 'object' ? trip.fleet : null;
      const trackingSummary = buildTrackingSummaryFromEvents(
        tripId ? (tripTimelineMap.get(tripId) || []) : [],
        { estDeliveryDate: computeEstimatedDeliveryDate(trip) }
      );
      const buyer = order.buyer && typeof order.buyer === 'object'
        ? {
            _id: order.buyer._id,
            name: order.buyer.name || order.buyer.businessName || 'Unknown buyer',
            businessName: order.buyer.businessName || null,
            image: order.buyer.image || null,
            phone: order.buyer.phone || null,
            state: order.buyer.state || null,
            address: order.buyer.address || null
          }
        : null;

      return {
        ...order,
        buyer,
        products: (order.products || []).map((item: any) => ({
          ...item,
          product: item.product && typeof item.product === 'object'
            ? {
                ...item.product,
                owner: buildOrderOwnerSummary(item.product.owner)
              }
            : item.product
        })),
        paymentMethod: paymentMethodMap.get(order._id.toString()) || null,
        transporter: buildTransporterSummaryForOrder(transporter, transporterStatsMap.get(transporterId) || null),
        fleet: buildFleetSummaryForOrder(fleet),
        fromLocation: trip?.origin || fleet?.route?.fromState || null,
        toLocation: trip?.destination || fleet?.route?.toState || null,
        trackingCode: trip?.trackingCode || null,
        currentLocation: {
          lat: trip?.currentLatitude ?? null,
          lng: trip?.currentLongitude ?? null,
          label: trip?.currentLocation || ''
        },
        currentLocationLabel: trip?.currentLocation || '',
        ...trackingSummary
      };
    })
    .filter((order: any) =>
      matchesSearch(
        [
          order._id,
          order.buyer?.name,
          order.buyer?.businessName,
          order.address,
          order.fromLocation,
          order.toLocation,
          ...(order.products || []).map((item: any) => item?.product?.name)
        ],
        options.search || null
      )
    );
}

export async function getTransporterReviewSummary(transporterId: string) {
  const reviews = await Review.find({ agent: transporterId })
    .populate('buyer', '_id name image businessName')
    .sort({ createdAt: -1 })
    .lean();

  const totalReviews = reviews.length;
  const totalRating = reviews.reduce((sum: number, review: any) => sum + Number(review.rating || 0), 0);
  const distribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((review: any) => Number(review.rating) === rating).length;
    return {
      rating,
      count,
      percentage: totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
    };
  });

  return {
    overallRating: totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(1)) : 0,
    totalReviews,
    ratingDistribution: distribution,
    recentReviewers: reviews.slice(0, 5).map((review: any) => ({
      id: review.buyer?._id?.toString?.() || null,
      name: review.buyer?.name || review.buyer?.businessName || 'Anonymous',
      avatar: review.buyer?.image || null
    }))
  };
}

export async function getTransporterOverview(transporterId: string) {
  const [orders, transactions, trucks, drivers, topCustomers, activeTrips] = await Promise.all([
    Order.find({ transporter: transporterId }).lean(),
    Transaction.find({}).lean(),
    Truck.find({ transporter: transporterId }).lean(),
    Driver.find({ transporter: transporterId }).lean(),
    getTransporterCustomerSummaries(transporterId),
    FleetTrip.find({ transporter: transporterId, status: { $in: ['planned', 'loaded', 'on_transit', 'arrived'] } }).lean()
  ]);

  const orderIds = new Set(orders.map((order: any) => order._id.toString()));
  const approvedTransactions = transactions.filter((tx: any) =>
    tx.status === 'approved' && tx.order && orderIds.has(tx.order.toString())
  );

  const driversById = new Map(drivers.map((driver: any) => [driver._id.toString(), driver]));
  const mostHiredDriversMap = new Map<string, { id: string; hires: number; driver: any }>();
  for (const trip of activeTrips) {
    const driverId = trip.driver?.toString?.();
    if (!driverId) continue;
    const existing = mostHiredDriversMap.get(driverId) || { id: driverId, hires: 0, driver: driversById.get(driverId) };
    existing.hires += 1;
    mostHiredDriversMap.set(driverId, existing);
  }

  return {
    revenue: approvedTransactions.reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0),
    bookings: orders.length,
    drivers: drivers.length,
    fleets: trucks.length,
    deltas: {
      revenue: 0,
      bookings: 0,
      drivers: 0,
      fleets: 0
    },
    topCustomers,
    mostHiredDrivers: Array.from(mostHiredDriversMap.values())
      .map((entry) => ({
        id: entry.id,
        name: entry.driver?.name || 'Unassigned driver',
        image: null,
        hires: entry.hires,
        rating: 0
      }))
      .sort((a, b) => b.hires - a.hires),
    transit: activeTrips
  };
}
