import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

type OrderLine = {
  product: any;
  quantity?: number;
  unit?: string | null;
  unitWeightKg?: number | null;
  unitPrice?: number | null;
  lineSubtotal?: number | null;
  localTransportFee?: number | null;
};

function toId(value: any) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

async function main() {
  const shouldWrite = process.argv.includes('--write');
  await mongoose.connect(MONGODB_URI);

  const { default: Order } = await import('../models/order');
  const { default: Bid } = await import('../models/bid');
  const { default: Transaction } = await import('../models/transaction');
  await import('../models/product');
  await import('../models/user');
  const { getEffectiveProductBidAmount } = await import('../lib/productBidAmount');

  const orders = await Order.find({
    bidIds: { $exists: true, $ne: [] }
  }).select('_id products bidIds totalAmount status createdAt updatedAt');

  let checked = 0;
  let changedOrders = 0;
  let changedTransactions = 0;
  let skippedOrders = 0;

  for (const order of orders as any[]) {
    checked += 1;
    const bidIds = Array.isArray(order.bidIds) ? order.bidIds : [];
    if (bidIds.length === 0) {
      continue;
    }

    const bids = await Bid.find({ _id: { $in: bidIds } }).select('_id product quantity unit unitWeightKg amount counterOffer');
    const bidMap = new Map(bids.map((bid: any) => [toId(bid.product), bid]));

    let hadMismatch = false;
    let couldBackfill = true;
    const nextProducts = (order.products || []).map((line: OrderLine) => {
      const productId = toId(line.product);
      const bid = productId ? bidMap.get(productId) : null;
      if (!bid) {
        couldBackfill = false;
        return line;
      }

      const quantity = Number(line.quantity || 0);
      const effectiveBidAmount = Number(getEffectiveProductBidAmount(bid) || 0);
      const nextUnitPrice = effectiveBidAmount;
      const nextLineSubtotal = Number((effectiveBidAmount * quantity).toFixed(2));

      if (
        Number(line.unitPrice || 0) !== nextUnitPrice ||
        Number(line.lineSubtotal || 0) !== nextLineSubtotal
      ) {
        hadMismatch = true;
      }

      return {
        ...line,
        unit: bid.unit ?? line.unit ?? 'kg',
        unitWeightKg: bid.unitWeightKg ?? line.unitWeightKg ?? null,
        unitPrice: nextUnitPrice,
        lineSubtotal: nextLineSubtotal
      };
    });

    if (!couldBackfill) {
      skippedOrders += 1;
      continue;
    }

    const nextTotalAmount = Number(
      nextProducts.reduce((sum: number, line: any) => {
        return sum + Number(line.lineSubtotal || 0) + Number(line.localTransportFee || 0);
      }, 0).toFixed(2)
    );

    const totalChanged = Number(order.totalAmount || 0) !== nextTotalAmount;
    if (!hadMismatch && !totalChanged) {
      continue;
    }

    changedOrders += 1;
    console.log(`[ORDER] ${order._id} total ${order.totalAmount} -> ${nextTotalAmount}`);

    if (shouldWrite) {
      order.products = nextProducts;
      order.totalAmount = nextTotalAmount;
      order.updatedAt = new Date();
      await order.save();
    }

    const transactions = await Transaction.find({ order: order._id }).select('_id amount status updatedAt');
    for (const transaction of transactions as any[]) {
      if (Number(transaction.amount || 0) === nextTotalAmount) {
        continue;
      }
      changedTransactions += 1;
      console.log(`  [TX] ${transaction._id} amount ${transaction.amount} -> ${nextTotalAmount}`);
      if (shouldWrite) {
        transaction.amount = nextTotalAmount;
        transaction.updatedAt = new Date();
        await transaction.save();
      }
    }
  }

  console.log('');
  console.log(`Checked orders: ${checked}`);
  console.log(`Orders needing backfill: ${changedOrders}`);
  console.log(`Transactions needing amount update: ${changedTransactions}`);
  console.log(`Orders skipped (missing bid linkage): ${skippedOrders}`);
  console.log(shouldWrite ? 'Write mode completed.' : 'Dry run only. Re-run with --write to persist changes.');
}

main()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    mongoose.connection.close().finally(() => process.exit(1));
  });
