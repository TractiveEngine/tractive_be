import FleetBid from '@/models/fleetBid';
import { buildShipmentLoadMeta } from '@/lib/fleetShipment';

export const fleetBidPopulate = [
  { path: 'buyer', select: '_id name email phone' },
  { path: 'fleet', select: '_id plateNumber fleetName fleetNumber model price pricingModel wholeTruckOnly estimatedDeliveryValue estimatedDeliveryUnit' }
];

export function serializeFleetBid(bid: any) {
  const bidObj = bid.toObject();
  return { ...bidObj, ...buildShipmentLoadMeta(bidObj.loadWeightKg) };
}

export async function populateAndSerializeFleetBid(bid: any) {
  let populatedBid = bid;
  for (const populate of fleetBidPopulate) {
    await populatedBid.populate(populate);
  }
  return serializeFleetBid(populatedBid);
}

export async function listFleetBids(query: Record<string, unknown>, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [bids, total] = await Promise.all([
    FleetBid.find(query)
      .populate(fleetBidPopulate)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    FleetBid.countDocuments(query)
  ]);

  return {
    data: bids.map(serializeFleetBid),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}
