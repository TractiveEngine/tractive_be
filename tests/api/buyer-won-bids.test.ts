import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { createAgent, createBid, createBuyer, createOrder, createProduct } from '../factories';
import { getEligibleWonBidsForBuyer } from '@/lib/buyerWonBids';

describe('Buyer won-bid checkout eligibility', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('does not return an accepted bid after any order has referenced it', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id });
    const bid = await createBid({
      buyer: buyer._id,
      agent: agent._id,
      product: product._id,
      amount: 5000,
      status: 'accepted'
    });

    await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 1 }],
      totalAmount: 5000,
      status: 'pending',
      bidIds: [bid._id]
    } as any);

    expect(await getEligibleWonBidsForBuyer(buyer._id.toString())).toEqual([]);
  });
});
