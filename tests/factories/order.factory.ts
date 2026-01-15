import Order from '@/models/order';
import mongoose from 'mongoose';

export interface CreateOrderOptions {
  buyer?: mongoose.Types.ObjectId | string;
  products?: Array<{
    product: mongoose.Types.ObjectId | string;
    quantity: number;
  }>;
  totalAmount?: number;
  status?: 'pending' | 'paid' | 'delivered';
  transportStatus?: 'pending' | 'picked' | 'on_transit' | 'delivered';
  transporter?: mongoose.Types.ObjectId | string;
  address?: string;
}

/**
 * Create an order
 */
export async function createOrder(options: CreateOrderOptions = {}) {
  const {
    buyer,
    products = [],
    totalAmount = Math.floor(Math.random() * 50000) + 1000,
    status = 'pending',
    transportStatus = 'pending',
    address = 'Test Delivery Address',
    ...rest
  } = options;

  if (!buyer) {
    throw new Error('Order buyer is required');
  }

  if (products.length === 0) {
    throw new Error('Order must have at least one product');
  }

  const order = await Order.create({
    buyer,
    products,
    totalAmount,
    status,
    transportStatus,
    address,
    ...rest,
  });

  return order;
}

/**
 * Create multiple orders
 */
export async function createOrders(
  count: number,
  buyer: mongoose.Types.ObjectId | string,
  products: Array<{ product: mongoose.Types.ObjectId | string; quantity: number }>,
  options: Omit<CreateOrderOptions, 'buyer' | 'products'> = {}
) {
  const orders = [];
  for (let i = 0; i < count; i++) {
    orders.push(await createOrder({ ...options, buyer, products }));
  }
  return orders;
}
