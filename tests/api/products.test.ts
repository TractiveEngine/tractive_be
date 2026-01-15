import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { POST as createProductHandler, GET as listProductsHandler } from '@/app/api/products/route';
import { GET as getProductHandler, PATCH as updateProductHandler, DELETE as deleteProductHandler } from '@/app/api/products/[id]/route';
import { createMockRequest, createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import { createAgent, createBuyer, createProduct, createAdmin } from '../factories';

describe('Product CRUD Test (Agent Role)', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('should allow agent to create, list, update, and delete products', async () => {
    // Create an agent user
    const { user: agent, token: agentToken } = await createAgent({
      email: 'agent@example.com',
      name: 'Test Agent',
    });

    // Step 1: Create a product
    const createRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/products',
      agent._id.toString(),
      {
        method: 'POST',
        body: {
          name: 'Fresh Tomatoes',
          description: 'Organic tomatoes from local farm',
          price: 5000,
          quantity: 100,
          categories: ['vegetables'],
        },
        email: agent.email,
        role: 'agent',
      }
    );

    const createResponse = await createProductHandler(createRequest);
    const createData = await getResponseJson(createResponse);

    expect(createResponse.status).toBe(201);
    expect(createData.product).toBeTruthy();
    expect(createData.product.name).toBe('Fresh Tomatoes');
    expect(createData.product.price).toBe(5000);
    expect(createData.product.owner.toString()).toBe(agent._id.toString());

    const productId = createData.product._id;

    // Step 2: List all products
    const listRequest = createMockRequest('http://localhost:3000/api/products');
    const listResponse = await listProductsHandler();
    const listData = await getResponseJson(listResponse);

    expect(listResponse.status).toBe(200);
    expect(listData.products).toBeInstanceOf(Array);
    expect(listData.products.length).toBeGreaterThan(0);
    expect(listData.products[0].name).toBe('Fresh Tomatoes');

    // Step 3: Get single product
    const getRequest = createMockRequest(`http://localhost:3000/api/products/${productId}`);
    const getResponse = await getProductHandler(getRequest, { params: { id: productId } });
    const getData = await getResponseJson(getResponse);

    expect(getResponse.status).toBe(200);
    expect(getData.product.name).toBe('Fresh Tomatoes');

    // Step 4: Update product
    const updateRequest = createAuthenticatedRequest(
      `http://localhost:3000/api/products/${productId}`,
      agent._id.toString(),
      {
        method: 'PATCH',
        body: {
          price: 6000,
          quantity: 150,
        },
        email: agent.email,
        role: 'agent',
      }
    );

    const updateResponse = await updateProductHandler(updateRequest, { params: { id: productId } });
    const updateData = await getResponseJson(updateResponse);

    expect(updateResponse.status).toBe(200);
    expect(updateData.product.price).toBe(6000);
    expect(updateData.product.quantity).toBe(150);

    // Step 5: Delete product
    const deleteRequest = createAuthenticatedRequest(
      `http://localhost:3000/api/products/${productId}`,
      agent._id.toString(),
      {
        method: 'DELETE',
        email: agent.email,
        role: 'agent',
      }
    );

    const deleteResponse = await deleteProductHandler(deleteRequest, { params: { id: productId } });
    const deleteData = await getResponseJson(deleteResponse);

    expect(deleteResponse.status).toBe(200);
    expect(deleteData.message).toContain('deleted');

    // Verify product is deleted
    const verifyRequest = createMockRequest(`http://localhost:3000/api/products/${productId}`);
    const verifyResponse = await getProductHandler(verifyRequest, { params: { id: productId } });

    expect(verifyResponse.status).toBe(404);
  });

  it('should prevent buyer from creating products', async () => {
    // Create a buyer user
    const { user: buyer } = await createBuyer({
      email: 'buyer@example.com',
      name: 'Test Buyer',
    });

    // Try to create a product as buyer
    const createRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/products',
      buyer._id.toString(),
      {
        method: 'POST',
        body: {
          name: 'Fresh Tomatoes',
          description: 'Organic tomatoes',
          price: 5000,
          quantity: 100,
        },
        email: buyer.email,
        role: 'buyer',
      }
    );

    const createResponse = await createProductHandler(createRequest);
    const createData = await getResponseJson(createResponse);

    expect(createResponse.status).toBe(403);
    expect(createData.error).toContain('admin or agent');
  });

  it('should require authentication to create products', async () => {
    const createRequest = createMockRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: {
        name: 'Fresh Tomatoes',
        price: 5000,
      },
    });

    const createResponse = await createProductHandler(createRequest);
    const createData = await getResponseJson(createResponse);

    expect(createResponse.status).toBe(401);
    expect(createData.error).toBe('Authentication required');
  });
});

describe('Product status & bulk operations (admin/agent)', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('updates single product status and lists out-of-stock', async () => {
    const { user: agent } = await createAgent();
    const product = await createProduct({ owner: agent._id, quantity: 5, status: 'available' });

    const patchReq = createAuthenticatedRequest(
      `http://localhost:3000/api/products/${product._id}/status`,
      agent._id.toString(),
      { method: 'PATCH', body: { status: 'out_of_stock' }, role: 'agent', email: agent.email }
    );
    const patchRes = await import('@/app/api/products/[id]/status/route').then((m) => m.PATCH(patchReq, { params: { id: product._id.toString() } }));
    const patchData = await getResponseJson(patchRes as unknown as Response);
    expect((patchRes as Response).status).toBe(200);
    expect(patchData.success).toBe(true);
    expect(patchData.data.status).toBe('out_of_stock');
    expect(patchData.data.quantity).toBe(0);

    const outReq = createAuthenticatedRequest(
      'http://localhost:3000/api/products/out-of-stock',
      agent._id.toString(),
      { method: 'GET', role: 'agent', email: agent.email }
    );
    const outRes = await import('@/app/api/products/out-of-stock/route').then((m) => m.GET(outReq));
    const outData = await getResponseJson(outRes as unknown as Response);
    expect((outRes as Response).status).toBe(200);
    expect(outData.data.length).toBeGreaterThan(0);
  });

  it('bulk updates and bulk deletes products', async () => {
    const { user: admin } = await createAdmin();
    const p1 = await createProduct({ owner: admin._id });
    const p2 = await createProduct({ owner: admin._id });

    const bulkStatusReq = createAuthenticatedRequest(
      'http://localhost:3000/api/products/bulk/status',
      admin._id.toString(),
      { method: 'PATCH', body: { productIds: [p1._id.toString(), p2._id.toString()], status: 'out_of_stock' }, role: 'admin', email: admin.email }
    );
    const bulkStatusRes = await import('@/app/api/products/bulk/status/route').then((m) => m.PATCH(bulkStatusReq));
    const bulkStatusData = await getResponseJson(bulkStatusRes as unknown as Response);
    expect((bulkStatusRes as Response).status).toBe(200);
    expect(bulkStatusData.data.updatedCount).toBe(2);

    const bulkDeleteReq = createAuthenticatedRequest(
      'http://localhost:3000/api/products/bulk/delete',
      admin._id.toString(),
      { method: 'POST', body: { productIds: [p1._id.toString(), p2._id.toString()] }, role: 'admin', email: admin.email }
    );
    const bulkDeleteRes = await import('@/app/api/products/bulk/delete/route').then((m) => m.POST(bulkDeleteReq));
    const bulkDeleteData = await getResponseJson(bulkDeleteRes as unknown as Response);
    expect((bulkDeleteRes as Response).status).toBe(200);
    expect(bulkDeleteData.data.deletedCount).toBe(2);
  });
});
