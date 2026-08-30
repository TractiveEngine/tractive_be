import mongoose from 'mongoose';
import Bid from '@/models/bid';
import Order from '@/models/order';
import '@/models/product';
import '@/models/user';
import { getEffectiveProductBidAmount } from '@/lib/productBidAmount';

export async function getEligibleWonBidsForBuyer(buyerId: string) {
  try {
    // A won bid is consumed the moment an order references it. Payment status
    // must not allow the same accepted bid to be checked out a second time.
    const orderQuery: any = {
      buyer: buyerId,
      bidIds: { $exists: true, $ne: [] }
    };

    const orders = await Order.find(orderQuery).select('bidIds');

    const consumedBidIds = orders
      .flatMap((order: any) => (Array.isArray(order.bidIds) ? order.bidIds : []))
      .map((id: any) => String(id))
      .filter((id: string) => mongoose.Types.ObjectId.isValid(id));

    const bidQuery: Record<string, unknown> = {
      buyer: buyerId,
      status: 'accepted'
    };
    if (consumedBidIds.length > 0) {
      bidQuery._id = { $nin: consumedBidIds };
    }

    const bids = await Bid.find(bidQuery)
      .populate('product')
      .populate({
        path: 'agent',
        select: '_id name email phone businessName address country state lga activeRole roles'
      });

    return bids.map((bid: any) => {
      const bidObject = typeof bid.toObject === 'function' ? bid.toObject() : bid;
      return {
        ...bidObject,
        effectiveAmount: getEffectiveProductBidAmount(bidObject)
      };
    });
  } catch (error) {
    console.error('Failed to resolve eligible won bids for buyer checkout:', error);
    return [];
  }
}
