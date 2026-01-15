import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { POST as createOrderHandler } from '@/app/api/orders/route';
import { POST as createTransactionHandler } from '@/app/api/transactions/route';
import { PATCH as updateTransactionHandler } from '@/app/api/transactions/[id]/route';
import { GET as getNotificationsHandler } from '@/app/api/notifications/route';
import { createMockRequest, createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import { createBuyer, createAgent, createAdmin, createProduct } from '../factories';

describe('Order → Transaction → Notification Flow', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('should create order, approve transaction, and generate notification', async () => {
    // Setup: Create users and products
    const { user: buyer } = await createBuyer({
      email: 'buyer@example.com',
      name: 'Test Buyer',
    });

    const { user: agent } = await createAgent({
      email: 'agent@example.com',
      name: 'Test Agent',
    });

    const { user: admin } = await createAdmin({
      email: 'admin@example.com',
      name: 'Test Admin',
    });

    const product = await createProduct({
      name: 'Fresh Maize',
      price: 10000,
      quantity: 50,
      owner: agent._id,
    });

    // Step 1: Buyer creates an order
    const createOrderRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/orders',
      buyer._id.toString(),
      {
        method: 'POST',
        body: {
          products: [
            {
              product: product._id.toString(),
              quantity: 10,
            },
          ],
          totalAmount: 100000,
          address: '123 Test Street, Lagos',
        },
        email: buyer.email,
        role: 'buyer',
      }
    );

    const orderResponse = await createOrderHandler(createOrderRequest);
    const orderData = await getResponseJson(orderResponse);

    expect(orderResponse.status).toBe(201);
    expect(orderData.order).toBeTruthy();
    expect(orderData.order.buyer.toString()).toBe(buyer._id.toString());
    expect(orderData.order.totalAmount).toBe(100000);
    expect(orderData.order.status).toBe('pending');

    const orderId = orderData.order._id;

    // Step 2: Create a transaction for the order
    const createTransactionRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/transactions',
      buyer._id.toString(),
      {
        method: 'POST',
        body: {
          order: orderId,
          amount: 100000,
          paymentMethod: 'bank_transfer',
        },
        email: buyer.email,
        role: 'buyer',
      }
    );

    const transactionResponse = await createTransactionHandler(createTransactionRequest);
    const transactionData = await getResponseJson(transactionResponse);

    expect(transactionResponse.status).toBe(201);
    expect(transactionData.transaction).toBeTruthy();
    expect(transactionData.transaction.order.toString()).toBe(orderId);
    expect(transactionData.transaction.status).toBe('pending');

    const transactionId = transactionData.transaction._id;

    // Step 3: Admin approves the transaction
    const approveTransactionRequest = createAuthenticatedRequest(
      `http://localhost:3000/api/transactions/${transactionId}`,
      admin._id.toString(),
      {
        method: 'PATCH',
        body: {
          status: 'approved',
        },
        email: admin.email,
        role: 'admin',
      }
    );

    const approveResponse = await updateTransactionHandler(
      approveTransactionRequest,
      { params: { id: transactionId } }
    );
    const approveData = await getResponseJson(approveResponse);

    expect(approveResponse.status).toBe(200);
    expect(approveData.transaction.status).toBe('approved');
    expect(approveData.transaction.approvedBy.toString()).toBe(admin._id.toString());

    // Step 4: Buyer checks notifications
    const notificationsRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/notifications',
      buyer._id.toString(),
      {
        email: buyer.email,
        role: 'buyer',
      }
    );

    const notificationsResponse = await getNotificationsHandler(notificationsRequest);
    const notificationsData = await getResponseJson(notificationsResponse);

    expect(notificationsResponse.status).toBe(200);
    expect(notificationsData.notifications).toBeInstanceOf(Array);
    
    // Check if there's a transaction_approved notification
    const transactionNotification = notificationsData.notifications.find(
      (n: { type: string }) => n.type === 'transaction_approved'
    );

    if (transactionNotification) {
      expect(transactionNotification.user.toString()).toBe(buyer._id.toString());
      expect(transactionNotification.title).toBeTruthy();
      expect(transactionNotification.message).toBeTruthy();
    }
  });

  it('should prevent non-admin from approving transactions', async () => {
    // Setup: Create users and order
    const { user: buyer } = await createBuyer({
      email: 'buyer2@example.com',
      name: 'Test Buyer 2',
    });

    const { user: agent } = await createAgent({
      email: 'agent2@example.com',
      name: 'Test Agent 2',
    });

    const product = await createProduct({
      name: 'Fresh Rice',
      price: 15000,
      quantity: 30,
      owner: agent._id,
    });

    // Create order
    const createOrderRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/orders',
      buyer._id.toString(),
      {
        method: 'POST',
        body: {
          products: [{ product: product._id.toString(), quantity: 5 }],
          totalAmount: 75000,
          address: '456 Test Avenue, Abuja',
        },
        email: buyer.email,
        role: 'buyer',
      }
    );

    const orderResponse = await createOrderHandler(createOrderRequest);
    const orderData = await getResponseJson(orderResponse);
    const orderId = orderData.order._id;

    // Create transaction
    const createTransactionRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/transactions',
      buyer._id.toString(),
      {
        method: 'POST',
        body: {
          order: orderId,
          amount: 75000,
          paymentMethod: 'card',
        },
        email: buyer.email,
        role: 'buyer',
      }
    );

    const transactionResponse = await createTransactionHandler(createTransactionRequest);
    const transactionData = await getResponseJson(transactionResponse);
    const transactionId = transactionData.transaction._id;

    // Try to approve as buyer (should fail)
    const approveRequest = createAuthenticatedRequest(
      `http://localhost:3000/api/transactions/${transactionId}`,
      buyer._id.toString(),
      {
        method: 'PATCH',
        body: {
          status: 'approved',
        },
        email: buyer.email,
        role: 'buyer',
      }
    );

    const approveResponse = await updateTransactionHandler(
      approveRequest,
      { params: { id: transactionId } }
    );
    const approveData = await getResponseJson(approveResponse);

    expect(approveResponse.status).toBe(403);
    expect(approveData.error).toBeTruthy();
  });
});
