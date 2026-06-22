import FleetTripTrackingEvent from '@/models/fleetTripTrackingEvent';
import Review from '@/models/review';
import SellerFollow from '@/models/sellerFollow';
import Transaction from '@/models/transaction';
import mongoose from 'mongoose';
import { getUnitWeightKg } from './productUnit';

function toIdString(value: any) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

function ratingLabel(value: number) {
  if (value >= 4.5) return 'Excellent';
  if (value >= 3.5) return 'Good';
  if (value > 0) return 'Average';
  return 'Not rated';
}

function yearsOfService(createdAt: Date | string | null | undefined) {
  if (!createdAt) return 0;
  return Math.max(0, new Date().getFullYear() - new Date(createdAt).getFullYear());
}

export function buildShipmentItemMeta(item: any) {
  const unit = item?.unit || null;
  const unitWeightKg = item?.unitWeightKg ?? getUnitWeightKg(unit);
  const loadWeightKg = typeof item?.loadWeightKg === 'number'
    ? item.loadWeightKg
    : (typeof item?.quantity === 'number' && typeof unitWeightKg === 'number'
      ? item.quantity * unitWeightKg
      : null);
  return {
    ...item,
    unit,
    unitWeightKg,
    loadWeightKg,
    loadWeightTonnes: typeof loadWeightKg === 'number' ? Number((loadWeightKg / 1000).toFixed(3)) : null,
    isBagUnit: unit === '50kg_bag' || unit === '100kg_bag',
  };
}

export function buildTrackingSummaryFromEvents(events: any[], options?: { estDeliveryDate?: Date | null }) {
  const normalizedEvents = Array.isArray(events) ? events : [];
  const firstByStatus = new Map<string, any>();
  for (const event of normalizedEvents) {
    if (event?.status && !firstByStatus.has(event.status)) {
      firstByStatus.set(event.status, event);
    }
  }

  const statusHistory = normalizedEvents.map((event) => ({
    status: event.status,
    timestamp: event.createdAt || event.timestamp || null,
    note: event.note || '',
    location: event.location || ''
  }));
  const lastEvent = normalizedEvents.length > 0 ? normalizedEvents[normalizedEvents.length - 1] : null;

  return {
    statusHistory,
    pickedAt: firstByStatus.get('loaded')?.createdAt || firstByStatus.get('picked')?.createdAt || null,
    onTransitAt: firstByStatus.get('on_transit')?.createdAt || null,
    deliveredAt: firstByStatus.get('delivered')?.createdAt || null,
    lastUpdatedAt: lastEvent?.createdAt || null,
    estDeliveryDate: options?.estDeliveryDate || null
  };
}

export async function buildTransporterStatsMap(transporterIds: string[]) {
  const ids = Array.from(new Set(transporterIds.filter(Boolean)));
  if (ids.length === 0) return new Map<string, any>();
  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const [reviewAgg, followAgg] = await Promise.all([
    Review.aggregate([
      { $match: { agent: { $in: objectIds } } },
      {
        $group: {
          _id: '$agent',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]),
    SellerFollow.aggregate([
      { $match: { seller: { $in: objectIds } } },
      { $group: { _id: '$seller', followers: { $sum: 1 } } }
    ])
  ]);

  const reviewMap = new Map(reviewAgg.map((row: any) => [toIdString(row._id), row]));
  const followMap = new Map(followAgg.map((row: any) => [toIdString(row._id), row.followers || 0]));
  const map = new Map<string, any>();
  for (const id of ids) {
    const review = reviewMap.get(id);
    map.set(id, {
      rating: review?.averageRating ?? 0,
      ratingLabel: ratingLabel(review?.averageRating ?? 0),
      totalReviews: review?.totalReviews ?? 0,
      followers: followMap.get(id) ?? 0
    });
  }
  return map;
}

export async function buildOrderPaymentMethodMap(orderIds: string[]) {
  const ids = Array.from(new Set(orderIds.filter(Boolean)));
  const map = new Map<string, string | null>();
  if (ids.length === 0) return map;

  const transactions = await Transaction.find({ order: { $in: ids } })
    .select('order paymentMethod createdAt updatedAt status')
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  for (const tx of transactions) {
    const orderId = toIdString((tx as any).order);
    if (orderId && !map.has(orderId)) {
      map.set(orderId, (tx as any).paymentMethod || null);
    }
  }
  return map;
}

export async function buildTripTimelineMap(tripIds: string[]) {
  const ids = Array.from(new Set(tripIds.filter(Boolean)));
  const map = new Map<string, any[]>();
  if (ids.length === 0) return map;

  const events = await FleetTripTrackingEvent.find({ fleetTrip: { $in: ids } })
    .sort({ createdAt: 1 })
    .lean();

  for (const event of events) {
    const tripId = toIdString((event as any).fleetTrip);
    if (!tripId) continue;
    if (!map.has(tripId)) map.set(tripId, []);
    map.get(tripId)!.push(event);
  }
  return map;
}

export function buildOrderOwnerSummary(owner: any) {
  if (!owner || typeof owner !== 'object') return owner;
  return {
    _id: owner._id,
    name: owner.name || null,
    businessName: owner.businessName || null,
    image: owner.image || null
  };
}

export function buildTransporterSummaryForOrder(transporter: any, stats?: any) {
  if (!transporter || typeof transporter !== 'object') return null;
  return {
    _id: transporter._id,
    name: transporter.name || transporter.businessName || 'Unknown',
    logo: transporter.image || null,
    avatar: transporter.image || null,
    image: transporter.image || null,
    company: transporter.businessName || null,
    businessName: transporter.businessName || null,
    location: transporter.state || transporter.address || null,
    rating: stats?.rating ?? 0,
    ratingLabel: stats?.ratingLabel ?? ratingLabel(0),
    followers: stats?.followers ?? 0,
    yearsOfService: yearsOfService(transporter.createdAt),
    phone: transporter.phone || null
  };
}

export function buildFleetSummaryForOrder(fleet: any) {
  if (!fleet || typeof fleet !== 'object') return null;
  return {
    _id: fleet._id,
    fleetName: fleet.fleetName || null,
    plateNumber: fleet.plateNumber || null,
    iotId: fleet.iot || fleet.tracker || null,
    model: fleet.model || null,
    image: Array.isArray(fleet.images) && fleet.images.length > 0 ? fleet.images[0] : null,
    route: fleet.route || null
  };
}

export function computeEstimatedDeliveryDate(trip: any) {
  if (!trip || typeof trip !== 'object') return null;
  const startDate = trip.startedAt || trip.createdAt;
  const estimateValue = Number(trip?.fleet?.estimatedDeliveryValue || 0);
  const estimateUnit = trip?.fleet?.estimatedDeliveryUnit;
  if (!startDate || !Number.isFinite(estimateValue) || estimateValue <= 0) {
    return null;
  }

  const baseDate = new Date(startDate);
  if (Number.isNaN(baseDate.getTime())) return null;

  if (estimateUnit === 'hours') {
    return new Date(baseDate.getTime() + (estimateValue * 60 * 60 * 1000));
  }
  if (estimateUnit === 'days') {
    return new Date(baseDate.getTime() + (estimateValue * 24 * 60 * 60 * 1000));
  }
  return null;
}
