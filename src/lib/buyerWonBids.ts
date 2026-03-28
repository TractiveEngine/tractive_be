import mongoose from 'mongoose';
import Bid from '@/models/bid';
import Order from '@/models/order';
import Transaction from '@/models/transaction';

export async function getEligibleWonBidsForBuyer(buyerId: string) {
  const paymentInFlightOrderIdsRaw = await Transaction.find({
    buyer: buyerId,
    status: { $in: ['pending', 'approved'] }
  }).distinct('order');

  const paymentInFlightOrderIds = paymentInFlightOrderIdsRaw.filter((id: any) =>
    id && mongoose.Types.ObjectId.isValid(String(id))
  );

  const paidOrderQuery: any = {
    buyer: buyerId,
    bidIds: { $exists: true, $ne: [] },
    status: { $in: ['payment_pending', 'paid', 'delivered'] }
  };

  if (paymentInFlightOrderIds.length > 0) {
    paidOrderQuery.$or = [
      { status: { $in: ['payment_pending', 'paid', 'delivered'] } },
      { _id: { $in: paymentInFlightOrderIds } }
    ];
  }

  const paidOrders = await Order.find(paidOrderQuery).select('bidIds');

  const consumedBidIds = paidOrders
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

  return Bid.find(bidQuery)
    .populate('product')
    .populate({
      path: 'agent',
      select: '_id name email phone businessName address country state lga activeRole roles'
    });
}
