import FleetBid from '@/models/fleetBid';
import { buildShipmentLoadMeta } from '@/lib/fleetShipment';

type FleetId = string;

function toObjectIdString(value: any): string | null {
  if (!value) return null;
  return value.toString?.() || String(value);
}

export async function getFleetBidSummaries(fleetIds: any[]) {
  const normalizedFleetIds = Array.from(
    new Set(fleetIds.map((id) => toObjectIdString(id)).filter(Boolean))
  ) as FleetId[];

  if (normalizedFleetIds.length === 0) {
    return new Map<FleetId, any>();
  }

  const bids = await FleetBid.find({ fleet: { $in: normalizedFleetIds } })
    .populate('buyer', '_id name')
    .sort({ updatedAt: -1, createdAt: -1 });

  const summaries = new Map<FleetId, any>();

  for (const fleetId of normalizedFleetIds) {
    summaries.set(fleetId, {
      totalBids: 0,
      activeBidsCount: 0,
      successfulBidsCount: 0,
      highestBidAmount: null,
      latestBidAmount: null,
      activeBidders: [],
      successfulBidders: []
    });
  }

  for (const bid of bids as any[]) {
    const fleetId = toObjectIdString(bid.fleet);
    if (!fleetId) continue;
    const summary = summaries.get(fleetId);
    if (!summary) continue;

    summary.totalBids += 1;
    if (summary.latestBidAmount === null) {
      summary.latestBidAmount = bid.counterAmount ?? bid.amount ?? null;
    }
    if (typeof bid.amount === 'number') {
      summary.highestBidAmount = summary.highestBidAmount === null
        ? bid.amount
        : Math.max(summary.highestBidAmount, bid.amount);
    }

    const buyer = bid.buyer
      ? {
          id: toObjectIdString(bid.buyer._id),
          name: bid.buyer.name || 'Buyer',
          ...buildShipmentLoadMeta(bid.loadWeightKg)
        }
      : null;

    if ((bid.status === 'pending' || bid.status === 'countered') && buyer) {
      summary.activeBidsCount += 1;
      if (!summary.activeBidders.some((entry: any) => entry.id === buyer.id)) {
        summary.activeBidders.push(buyer);
      }
    }

    if (bid.status === 'accepted' && buyer) {
      summary.successfulBidsCount += 1;
      if (!summary.successfulBidders.some((entry: any) => entry.id === buyer.id)) {
        summary.successfulBidders.push(buyer);
      }
    }
  }

  return summaries;
}
