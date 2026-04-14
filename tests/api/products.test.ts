import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { POST as createProductHandler, GET as listProductsHandler } from '@/app/api/products/route';
import { GET as getProductHandler, PATCH as updateProductHandler, DELETE as deleteProductHandler } from '@/app/api/products/[id]/route';
import { createMockRequest, createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import { createAgent, createBuyer, createProduct, createAdmin, createWishlistItem, createOrder } from '../factories';
import Product from '@/models/product';

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

  it('should scope authenticated agent product listing to own products', async () => {
    const { user: agentA } = await createAgent({ email: 'agentA@example.com' });
    const { user: agentB } = await createAgent({ email: 'agentB@example.com' });
    await createProduct({ owner: agentA._id, name: 'AgentA Product' });
    await createProduct({ owner: agentB._id, name: 'AgentB Product' });

    const scopedReq = createAuthenticatedRequest('http://localhost:3000/api/products', agentA._id.toString(), {
      method: 'GET',
      role: 'agent',
      email: agentA.email,
    });
    const scopedRes = await listProductsHandler(scopedReq);
    const scopedData = await getResponseJson(scopedRes);

    expect(scopedRes.status).toBe(200);
    expect(Array.isArray(scopedData.data)).toBe(true);
    expect(scopedData.data.length).toBe(1);
    expect(scopedData.data[0].name).toBe('AgentA Product');
  });

  it('adds category fields and wishlisted flag to product responses', async () => {
    const { user: agent } = await createAgent({ email: 'agent-categories@example.com' });
    const { user: buyer } = await createBuyer({ email: 'buyer-categories@example.com' });

    const createRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/products',
      agent._id.toString(),
      {
        method: 'POST',
        body: {
          name: 'Premium Rice',
          price: 7000,
          category: 'Grains',
          subcategory: 'Rice',
          images: ['https://example.com/rice.jpg'],
        },
        email: agent.email,
        role: 'agent',
      }
    );
    const createResponse = await createProductHandler(createRequest);
    const createData = await getResponseJson(createResponse);
    const productId = createData.product._id.toString();

    await createWishlistItem({ buyer: buyer._id, product: productId });

    const listRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/products?category=Grains&subcategory=Rice',
      buyer._id.toString(),
      { method: 'GET', email: buyer.email, role: 'buyer' }
    );
    const listResponse = await listProductsHandler(listRequest);
    const listData = await getResponseJson(listResponse);

    expect(listResponse.status).toBe(200);
    expect(listData.data.length).toBe(1);
    expect(listData.data[0].category).toBe('Grains');
    expect(listData.data[0].subcategory).toBe('Rice');
    expect(listData.data[0].wishlisted).toBe(true);

    const getRequest = createAuthenticatedRequest(
      `http://localhost:3000/api/products/${productId}`,
      buyer._id.toString(),
      { method: 'GET', email: buyer.email, role: 'buyer' }
    );
    const getResponse = await getProductHandler(getRequest, { params: Promise.resolve({ id: productId }) });
    const getData = await getResponseJson(getResponse);

    expect(getResponse.status).toBe(200);
    expect(getData.product.category).toBe('Grains');
    expect(getData.product.subcategory).toBe('Rice');
    expect(getData.product.wishlisted).toBe(true);
  });

  it('creates products with local transport and preserves normalized category fields', async () => {
    const { user: agent } = await createAgent({ email: 'agent-local-transport@example.com' });

    const createRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/products',
      agent._id.toString(),
      {
        method: 'POST',
        body: {
          name: 'Fresh Maize',
          description: 'High quality yellow maize from Kaduna farms',
          price: 3800,
          quantity: 100,
          discount: 10,
          unit: 'kg',
          category: 'Grains',
          subcategory: 'Maize',
          categories: ['Grains', 'Maize'],
          images: ['https://example.com/maize1.jpg'],
          videos: ['https://example.com/maize1.mp4'],
          localTransport: {
            required: true,
            fee: 2500,
            from: 'Kachia Farm',
            to: 'Kaduna Aggregation Point',
            note: 'Farm gate pickup to interstate loading point',
          },
        },
        email: agent.email,
        role: 'agent',
      }
    );

    const createResponse = await createProductHandler(createRequest);
    const createData = await getResponseJson(createResponse);

    expect(createResponse.status).toBe(201);
    expect(createData.product.category).toBe('Grains');
    expect(createData.product.subcategory).toBe('Maize');
    expect(createData.product.categories).toEqual(['Grains', 'Maize']);
    expect(createData.product.localTransport).toEqual({
      required: true,
      fee: 2500,
      from: 'Kachia Farm',
      to: 'Kaduna Aggregation Point',
      note: 'Farm gate pickup to interstate loading point',
    });
    expect(createData.product.status).toBe('available');
  });

  it('normalizes product units and reserves stock for accepted bids', async () => {
    const { user: agent } = await createAgent({ email: 'agent-stock@example.com' });
    const { user: buyer } = await createBuyer({ email: 'buyer-stock@example.com' });

    const createRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/products',
      agent._id.toString(),
      {
        method: 'POST',
        body: {
          name: 'Bagged Rice',
          price: 25000,
          quantity: 5,
          unit: '50kg bag',
        },
        email: agent.email,
        role: 'agent',
      }
    );
    const createResponse = await createProductHandler(createRequest);
    const createData = await getResponseJson(createResponse);
    expect(createResponse.status).toBe(201);
    expect(createData.product.unit).toBe('50kg_bag');
    expect(createData.product.unitWeightKg).toBe(50);

    const bidReq = createAuthenticatedRequest(
      `http://localhost:3000/api/buyers/products/${createData.product._id}/bid`,
      buyer._id.toString(),
      {
        method: 'POST',
        body: { amount: 50000, quantity: 2 },
        email: buyer.email,
        role: 'buyer',
      }
    );
    const bidRes = await import('@/app/api/buyers/products/[productId]/bid/route').then((m) =>
      m.POST(bidReq, { params: Promise.resolve({ productId: createData.product._id.toString() }) })
    );
    const bidData = await getResponseJson(bidRes as unknown as Response);
    expect((bidRes as Response).status).toBe(201);
    expect(bidData.data.quantity).toBe(2);
    expect(bidData.data.unit).toBe('50kg_bag');

    const acceptReq = createAuthenticatedRequest(
      `http://localhost:3000/api/bids/${bidData.data._id}`,
      agent._id.toString(),
      {
        method: 'PATCH',
        body: { status: 'accepted' },
        email: agent.email,
        role: 'agent',
      }
    );
    const acceptRes = await import('@/app/api/bids/[id]/route').then((m) =>
      m.PATCH(acceptReq, { params: Promise.resolve({ id: bidData.data._id.toString() }) })
    );
    expect((acceptRes as Response).status).toBe(200);

    const reservedProduct = await Product.findById(createData.product._id);
    expect(reservedProduct?.quantity).toBe(3);
    expect(reservedProduct?.status).toBe('available');

    const rejectReq = createAuthenticatedRequest(
      `http://localhost:3000/api/bids/${bidData.data._id}`,
      agent._id.toString(),
      {
        method: 'PATCH',
        body: { status: 'rejected' },
        email: agent.email,
        role: 'agent',
      }
    );
    const rejectRes = await import('@/app/api/bids/[id]/route').then((m) =>
      m.PATCH(rejectReq, { params: Promise.resolve({ id: bidData.data._id.toString() }) })
    );
    expect((rejectRes as Response).status).toBe(200);

    const restoredProduct = await Product.findById(createData.product._id);
    expect(restoredProduct?.quantity).toBe(5);
    expect(restoredProduct?.status).toBe('available');
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

  it('returns product images in buyer top-selling responses', async () => {
    const { user: buyer } = await createBuyer();
    const { user: agent } = await createAgent();
    const product = await createProduct({
      owner: agent._id,
      name: 'Top Product',
      images: ['https://example.com/top-product.jpg'],
      categories: ['Grains', 'Rice']
    });
    await createOrder({
      buyer: buyer._id,
      products: [{ product: product._id, quantity: 2 }],
      totalAmount: 15000,
      status: 'paid'
    });

    const req = createAuthenticatedRequest('http://localhost:3000/api/buyers/top-selling', buyer._id.toString(), {
      method: 'GET',
      role: 'buyer',
      email: buyer.email,
    });
    const res = await import('@/app/api/buyers/top-selling/route').then((m) => m.GET(req));
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(data.data[0].image).toBe('https://example.com/top-product.jpg');
    expect(Array.isArray(data.data[0].images)).toBe(true);
  });

  it('lists available product categories', async () => {
    const res = await import('@/app/api/categories/route').then((m) => m.GET());
    const data = await getResponseJson(res as unknown as Response);

    expect((res as Response).status).toBe(200);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.some((item: { name: string }) => item.name === 'Grains')).toBe(true);
  });

  it('keeps wishlisted/category fields consistent across seller detail, similar products, and wishlist endpoints', async () => {
    const { user: agent } = await createAgent({ email: 'seller-detail@example.com', name: 'Seller Detail Agent' });
    const { user: buyer } = await createBuyer({ email: 'seller-detail-buyer@example.com' });

    const rice = await createProduct({
      owner: agent._id,
      name: 'Filtered Rice',
      category: 'Grains',
      subcategory: 'Rice',
      categories: ['Grains', 'Rice'],
      images: ['https://example.com/rice-detail.jpg']
    });
    const similarRice = await createProduct({
      owner: agent._id,
      name: 'Second Rice',
      category: 'Grains',
      subcategory: 'Rice',
      categories: ['Grains', 'Rice'],
      images: ['https://example.com/rice-similar.jpg']
    });
    await createProduct({
      owner: agent._id,
      name: 'Yam Product',
      category: 'Tubers',
      subcategory: 'Yam',
      categories: ['Tubers', 'Yam']
    });

    await createWishlistItem({ buyer: buyer._id, product: rice._id });

    const sellerDetailReq = createAuthenticatedRequest(
      `http://localhost:3000/api/sellers/${agent._id}?category=Grains&subcategory=Rice`,
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const sellerDetailRes = await import('@/app/api/sellers/[id]/route').then((m) =>
      m.GET(sellerDetailReq, { params: Promise.resolve({ id: agent._id.toString() }) })
    );
    const sellerDetailData = await getResponseJson(sellerDetailRes as unknown as Response);
    expect((sellerDetailRes as Response).status).toBe(200);
    expect(sellerDetailData.data.products.length).toBe(2);
    expect(sellerDetailData.data.products.every((item: { category: string; subcategory: string }) => item.category === 'Grains' && item.subcategory === 'Rice')).toBe(true);
    expect(sellerDetailData.data.products[0]).toHaveProperty('wishlisted');
    expect(Array.isArray(sellerDetailData.data.recommendations)).toBe(true);
    expect(sellerDetailData.pagination.total).toBe(2);

    const similarReq = createAuthenticatedRequest(
      `http://localhost:3000/api/products/${rice._id}/similar`,
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const similarRes = await import('@/app/api/products/[id]/similar/route').then((m) =>
      m.GET(similarReq, { params: Promise.resolve({ id: rice._id.toString() }) })
    );
    const similarData = await getResponseJson(similarRes as unknown as Response);
    expect((similarRes as Response).status).toBe(200);
    expect(similarData.data[0]).toHaveProperty('wishlisted');
    expect(similarData.data[0]).toHaveProperty('category');

    const sellerProductReq = createAuthenticatedRequest(
      `http://localhost:3000/api/sellers/products/${rice._id}`,
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const sellerProductRes = await import('@/app/api/sellers/products/[id]/route').then((m) =>
      m.GET(sellerProductReq, { params: { id: rice._id.toString() } })
    );
    const sellerProductData = await getResponseJson(sellerProductRes as unknown as Response);
    expect((sellerProductRes as Response).status).toBe(200);
    expect(sellerProductData.data.wishlisted).toBe(true);
    expect(sellerProductData.data.category).toBe('Grains');

    const wishlistReq = createAuthenticatedRequest(
      'http://localhost:3000/api/buyers/wishlist',
      buyer._id.toString(),
      { method: 'GET', role: 'buyer', email: buyer.email }
    );
    const wishlistRes = await import('@/app/api/buyers/wishlist/route').then((m) => m.GET(wishlistReq));
    const wishlistData = await getResponseJson(wishlistRes as unknown as Response);
    expect((wishlistRes as Response).status).toBe(200);
    expect(wishlistData.data[0].wishlisted).toBe(true);
    expect(wishlistData.data[0].product.wishlisted).toBe(true);
    expect(wishlistData.data[0].product.category).toBe('Grains');
  });
});
