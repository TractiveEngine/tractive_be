import Bid from '@/models/bid';
import mongoose from 'mongoose';

export interface CreateBidOptions {
  product?: mongoose.Types.ObjectId | string;
  buyer?: mongoose.Types.ObjectId | string;
  agent?: mongoose.Types.ObjectId | string;
  amount?: number;
  status?: 'pending' | 'accepted' | 'rejected';
  message?: string;
}

/**
 * Create a bid
 */
export async function createBid(options: CreateBidOptions = {}) {
  const {
    product,
    buyer,
    agent,
    amount = Math.floor(Math.random() * 10000) + 500,
    status = 'pending',
    message = 'I would like to purchase this product',
  } = options;

  if (!product) {
    throw new Error('Bid product is required');
  }

  if (!buyer) {
    throw new Error('Bid buyer is required');
  }

  const bid = await Bid.create({
    product,
    buyer,
    agent,
    amount,
    status,
    message,
  });

  return bid;
}

/**
 * Create multiple bids
 */
export async function createBids(
  count: number,
  product: mongoose.Types.ObjectId | string,
  buyer: mongoose.Types.ObjectId | string,
  options: Omit<CreateBidOptions, 'product' | 'buyer'> = {}
) {
  const bids = [];
  for (let i = 0; i < count; i++) {
    bids.push(await createBid({ ...options, product, buyer }));
  }
  return bids;
}
