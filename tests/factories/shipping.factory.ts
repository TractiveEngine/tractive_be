import ShippingRequest from '@/models/shipping';
import mongoose from 'mongoose';

export interface CreateShippingRequestOptions {
  buyer?: mongoose.Types.ObjectId | string;
  product?: mongoose.Types.ObjectId | string;
  productName?: string;
  productImage?: string;
  productSizeInKG?: number;
  totalKG?: number;
  totalAmount?: number;
  negotiable?: boolean;
  negotiationPrice?: number | null;
  paymentMethod?: 'transfer' | 'card' | 'deposit' | 'cheque';
  bankTransferDetails?: string;
  transporter?: mongoose.Types.ObjectId | string | null;
  status?: 'pending' | 'in_negotiation' | 'accepted' | 'rejected';
}

/**
 * Create a shipping request
 */
export async function createShippingRequest(options: CreateShippingRequestOptions = {}) {
  const {
    buyer,
    product,
    productName = 'Test Product',
    productImage = 'https://example.com/product.jpg',
    productSizeInKG = 50,
    totalKG = 500,
    totalAmount = Math.floor(Math.random() * 50000) + 5000,
    negotiable = false,
    negotiationPrice = null,
    paymentMethod = 'transfer',
    bankTransferDetails = 'Bank: Test Bank, Account: 1234567890',
    transporter = null,
    status = 'pending',
  } = options;

  if (!buyer) {
    throw new Error('ShippingRequest buyer is required');
  }

  if (!product) {
    throw new Error('ShippingRequest product is required');
  }

  const shippingRequest = await ShippingRequest.create({
    buyer,
    product,
    productName,
    productImage,
    productSizeInKG,
    totalKG,
    totalAmount,
    negotiable,
    negotiationPrice,
    paymentMethod,
    bankTransferDetails,
    transporter,
    status,
  });

  return shippingRequest;
}

/**
 * Create multiple shipping requests
 */
export async function createShippingRequests(
  count: number,
  buyer: mongoose.Types.ObjectId | string,
  product: mongoose.Types.ObjectId | string,
  options: Omit<CreateShippingRequestOptions, 'buyer' | 'product'> = {}
) {
  const requests = [];
  for (let i = 0; i < count; i++) {
    requests.push(await createShippingRequest({ ...options, buyer, product }));
  }
  return requests;
}
