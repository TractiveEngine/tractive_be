import Transaction from '@/models/transaction';
import mongoose from 'mongoose';

export interface CreateTransactionOptions {
  order?: mongoose.Types.ObjectId | string;
  buyer?: mongoose.Types.ObjectId | string;
  amount?: number;
  status?: 'pending' | 'approved';
  paymentMethod?: string;
  approvedBy?: mongoose.Types.ObjectId | string;
}

/**
 * Create a transaction
 */
export async function createTransaction(options: CreateTransactionOptions = {}) {
  const {
    order,
    buyer,
    amount = Math.floor(Math.random() * 50000) + 1000,
    status = 'pending',
    paymentMethod = 'bank_transfer',
    ...rest
  } = options;

  if (!order) {
    throw new Error('Transaction order is required');
  }

  if (!buyer) {
    throw new Error('Transaction buyer is required');
  }

  const transaction = await Transaction.create({
    order,
    buyer,
    amount,
    status,
    paymentMethod,
    ...rest,
  });

  return transaction;
}

/**
 * Create multiple transactions
 */
export async function createTransactions(
  count: number,
  order: mongoose.Types.ObjectId | string,
  buyer: mongoose.Types.ObjectId | string,
  options: Omit<CreateTransactionOptions, 'order' | 'buyer'> = {}
) {
  const transactions = [];
  for (let i = 0; i < count; i++) {
    transactions.push(await createTransaction({ ...options, order, buyer }));
  }
  return transactions;
}
