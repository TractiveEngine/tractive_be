import NegotiationOffer from '@/models/negotiation';
import mongoose from 'mongoose';

export interface CreateNegotiationOfferOptions {
  shippingRequest?: mongoose.Types.ObjectId | string;
  transporter?: mongoose.Types.ObjectId | string;
  negotiatorName?: string;
  amount?: number;
  weightInKG?: number;
  routeFrom?: string;
  routeTo?: string;
  negotiationStatus?: 'pending' | 'accepted' | 'rejected';
}

/**
 * Create a negotiation offer
 */
export async function createNegotiationOffer(options: CreateNegotiationOfferOptions = {}) {
  const {
    shippingRequest,
    transporter,
    negotiatorName = 'Test Negotiator',
    amount = Math.floor(Math.random() * 30000) + 5000,
    weightInKG = 500,
    routeFrom = 'Lagos',
    routeTo = 'Abuja',
    negotiationStatus = 'pending',
  } = options;

  if (!shippingRequest) {
    throw new Error('NegotiationOffer shippingRequest is required');
  }

  if (!transporter) {
    throw new Error('NegotiationOffer transporter is required');
  }

  const negotiationOffer = await NegotiationOffer.create({
    shippingRequest,
    transporter,
    negotiatorName,
    amount,
    weightInKG,
    routeFrom,
    routeTo,
    negotiationStatus,
  });

  return negotiationOffer;
}

/**
 * Create multiple negotiation offers
 */
export async function createNegotiationOffers(
  count: number,
  shippingRequest: mongoose.Types.ObjectId | string,
  transporter: mongoose.Types.ObjectId | string,
  options: Omit<CreateNegotiationOfferOptions, 'shippingRequest' | 'transporter'> = {}
) {
  const offers = [];
  for (let i = 0; i < count; i++) {
    offers.push(await createNegotiationOffer({ ...options, shippingRequest, transporter }));
  }
  return offers;
}
