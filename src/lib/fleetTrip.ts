import FleetTrip from '@/models/fleetTrip';
import FleetTripTrackingEvent from '@/models/fleetTripTrackingEvent';
import FleetBooking from '@/models/fleetBooking';
import FleetPayment from '@/models/fleetPayment';
import Order from '@/models/order';

function uniqueObjectIds(values: any[]) {
  return Array.from(new Map(values.filter(Boolean).map((value) => [value.toString(), value])).values());
}

export function mapTripStatusToOrderTransportStatus(status: unknown): 'pending' | 'picked' | 'on_transit' | 'delivered' {
  switch (status) {
    case 'loaded':
      return 'picked';
    case 'on_transit':
      return 'on_transit';
    case 'arrived':
    case 'delivered':
      return 'delivered';
    case 'cancelled':
    case 'planned':
    default:
      return 'pending';
  }
}

export function buildFleetTripLoadMeta(loadWeightKg: unknown) {
  const numericLoadWeightKg = Number(loadWeightKg);
  if (!Number.isFinite(numericLoadWeightKg) || numericLoadWeightKg <= 0) {
    return {
      loadWeightKg: null,
      loadWeightTonnes: null
    };
  }

  return {
    loadWeightKg: numericLoadWeightKg,
    loadWeightTonnes: Math.round((numericLoadWeightKg / 1000) * 100) / 100
  };
}

export async function syncTripOrders(tripId: any, tripStatus: unknown) {
  const orderIds = await Order.find({ fleetTripId: tripId }).distinct('_id');
  if (orderIds.length === 0) return;

  await Order.updateMany(
    { _id: { $in: orderIds } },
    {
      $set: {
        fleetTripId: tripId,
        transportStatus: mapTripStatusToOrderTransportStatus(tripStatus),
        updatedAt: new Date()
      }
    }
  );
}

export async function appendFleetTripTrackingEvent({
  tripId,
  status,
  note,
  location,
  updatedBy,
  updatedByRole
}: {
  tripId: any;
  status: string;
  note?: string | null;
  location?: string | null;
  updatedBy?: any;
  updatedByRole?: string | null;
}) {
  return FleetTripTrackingEvent.create({
    fleetTrip: tripId,
    status,
    note: note || '',
    location: location || '',
    updatedBy: updatedBy || null,
    updatedByRole: updatedByRole || null
  });
}

export async function createFleetTripFromBooking({
  booking,
  payment,
  driverId,
  origin,
  destination,
  createdBy
}: {
  booking: any;
  payment?: any;
  driverId?: any;
  origin?: string | null;
  destination?: string | null;
  createdBy?: any;
}) {
  const shipmentItems = Array.isArray(booking.shipmentItems) ? booking.shipmentItems : [];
  const orderIds = uniqueObjectIds(shipmentItems.map((item: any) => item.orderId));
  const buyerIds = uniqueObjectIds([booking.buyer]);

  const trip = await FleetTrip.create({
    fleet: booking.fleet,
    transporter: booking.transporter,
    driver: driverId || null,
    bookingIds: [booking._id],
    paymentIds: payment?._id ? [payment._id] : [],
    orderIds,
    buyerIds,
    status: 'planned',
    origin: origin ?? null,
    destination: destination ?? null,
    currentLocation: origin ?? null,
    trackingCode: `TRIP-${Date.now()}`,
    loadWeightKg: Number(booking.loadWeightKg || payment?.loadWeightKg || 0),
    wholeTruckOnly: booking.wholeTruckOnly === true,
    createdBy: createdBy || null
  });

  booking.fleetTripId = trip._id;
  booking.updatedAt = new Date();
  await booking.save();

  if (payment) {
    payment.fleetTripId = trip._id;
    payment.updatedAt = new Date();
    await payment.save();
  }

  await Order.updateMany(
    { _id: { $in: orderIds } },
    {
      $set: {
        fleetTripId: trip._id,
        transporter: booking.transporter,
        transportStatus: mapTripStatusToOrderTransportStatus(trip.status),
        updatedAt: new Date()
      }
    }
  );

  await appendFleetTripTrackingEvent({
    tripId: trip._id,
    status: 'planned',
    note: payment ? 'Trip created from approved fleet payment' : 'Trip created',
    location: origin ?? '',
    updatedBy: createdBy || null,
    updatedByRole: null
  });

  return trip;
}

export async function createFleetTripFromConfirmedBookings({
  fleetId,
  bookingIds,
  driverId,
  origin,
  destination,
  createdBy
}: {
  fleetId: any;
  bookingIds: any[];
  driverId?: any;
  origin?: string | null;
  destination?: string | null;
  createdBy?: any;
}) {
  const bookings = await FleetBooking.find({
    _id: { $in: bookingIds },
    fleet: fleetId,
    status: 'confirmed',
    fleetTripId: null
  });

  if (bookings.length !== bookingIds.length) {
    throw new Error('One or more bookings are not confirmed, not on this fleet, or already assigned to a trip');
  }

  const transporterIds = uniqueObjectIds(bookings.map((booking: any) => booking.transporter));
  if (transporterIds.length !== 1) {
    throw new Error('Selected bookings must belong to the same transporter');
  }

  const orderIds = uniqueObjectIds(bookings.flatMap((booking: any) => (booking.shipmentItems || []).map((item: any) => item.orderId)));
  const paymentIds = uniqueObjectIds(bookings.map((booking: any) => booking.payment));
  const buyerIds = uniqueObjectIds(bookings.map((booking: any) => booking.buyer));
  const loadWeightKg = bookings.reduce((sum: number, booking: any) => sum + Number(booking.loadWeightKg || 0), 0);
  const wholeTruckOnly = bookings.some((booking: any) => booking.wholeTruckOnly === true);

  const trip = await FleetTrip.create({
    fleet: fleetId,
    transporter: transporterIds[0],
    driver: driverId || null,
    bookingIds: bookings.map((booking: any) => booking._id),
    paymentIds,
    orderIds,
    buyerIds,
    status: 'planned',
    origin: origin ?? null,
    destination: destination ?? null,
    currentLocation: origin ?? null,
    trackingCode: `TRIP-${Date.now()}`,
    loadWeightKg,
    wholeTruckOnly,
    createdBy: createdBy || null
  });

  await FleetBooking.updateMany(
    { _id: { $in: bookings.map((booking: any) => booking._id) } },
    { $set: { fleetTripId: trip._id, updatedAt: new Date() } }
  );
  await FleetPayment.updateMany(
    { _id: { $in: paymentIds } },
    { $set: { fleetTripId: trip._id, updatedAt: new Date() } }
  );
  await Order.updateMany(
    { _id: { $in: orderIds } },
    {
      $set: {
        fleetTripId: trip._id,
        transporter: transporterIds[0],
        transportStatus: mapTripStatusToOrderTransportStatus(trip.status),
        updatedAt: new Date()
      }
    }
  );

  await appendFleetTripTrackingEvent({
    tripId: trip._id,
    status: 'planned',
    note: 'Trip created from confirmed fleet bookings',
    location: origin ?? '',
    updatedBy: createdBy || null,
    updatedByRole: null
  });

  return trip;
}
