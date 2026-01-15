import fc from 'fast-check';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import WishlistItem from '@/models/wishlist';
import Product from '@/models/product';
import User from '@/models/user';

// Feature: buyer-social-layer, Property 1: Wishlist uniqueness preservation
// Validates: Requirements 1.2
describe('Property 1: Wishlist uniqueness preservation', () => {
  beforeAll(async () => {
    await dbConnect();
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await WishlistItem.deleteMany({});
      await Product.deleteMany({});
      await User.deleteMany({});
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  it('should maintain exactly one wishlist entry when adding the same product multiple times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        async (productName, buyerUuid, addCount) => {
          // Create a buyer with unique email
          const buyer = await User.create({
            email: `buyer-${buyerUuid}@test.com`,
            password: 'testpass123',
            roles: ['buyer'],
            isVerified: true,
          });

          // Create a product
          const product = await Product.create({
            name: `${productName}-${buyerUuid}`,
            price: 100,
            quantity: 10,
            owner: buyer._id,
          });

          // Add the same product multiple times
          for (let i = 0; i < addCount; i++) {
            try {
              await WishlistItem.create({
                buyer: buyer._id,
                product: product._id,
              });
            } catch (error: any) {
              // Ignore duplicate key errors
              if (error.code !== 11000) throw error;
            }
          }

          // Verify only one entry exists
          const count = await WishlistItem.countDocuments({
            buyer: buyer._id,
            product: product._id,
          });

          expect(count).toBe(1);

          // Cleanup
          await WishlistItem.deleteMany({ buyer: buyer._id });
          await Product.deleteOne({ _id: product._id });
          await User.deleteOne({ _id: buyer._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: buyer-social-layer, Property 2: Wishlist item retrieval completeness
// Validates: Requirements 1.3
describe('Property 2: Wishlist item retrieval completeness', () => {
  beforeAll(async () => {
    await dbConnect();
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await WishlistItem.deleteMany({});
      await Product.deleteMany({});
      await User.deleteMany({});
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  it('should return all and only the products that buyer has added', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
        async (buyerUuid, productNames) => {
          // Create a buyer with unique email
          const buyer = await User.create({
            email: `buyer-${buyerUuid}@test.com`,
            password: 'testpass123',
            roles: ['buyer'],
            isVerified: true,
          });

          // Create products
          const products = await Promise.all(
            productNames.map((name, index) =>
              Product.create({
                name: `${name}-${buyerUuid}-${index}`,
                price: 100 + index,
                quantity: 10,
                owner: buyer._id,
              })
            )
          );

          // Add all products to wishlist
          await Promise.all(
            products.map((product) =>
              WishlistItem.create({
                buyer: buyer._id,
                product: product._id,
              })
            )
          );

          // Retrieve wishlist
          const wishlistItems = await WishlistItem.find({ buyer: buyer._id });

          // Verify count matches
          expect(wishlistItems.length).toBe(products.length);

          // Verify all product IDs are present
          const wishlistProductIds = wishlistItems.map((item) => item.product.toString());
          const expectedProductIds = products.map((p) => p._id.toString());

          expectedProductIds.forEach((id) => {
            expect(wishlistProductIds).toContain(id);
          });

          // Cleanup
          await WishlistItem.deleteMany({ buyer: buyer._id });
          await Product.deleteMany({ _id: { $in: products.map((p) => p._id) } });
          await User.deleteOne({ _id: buyer._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: buyer-social-layer, Property 3: Wishlist removal idempotence
// Validates: Requirements 1.4
describe('Property 3: Wishlist removal idempotence', () => {
  beforeAll(async () => {
    await dbConnect();
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      await WishlistItem.deleteMany({});
      await Product.deleteMany({});
      await User.deleteMany({});
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });

  it('should result in the same state when removing a product once or multiple times', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        async (productName, buyerUuid, removeCount) => {
          // Create a buyer with unique email
          const buyer = await User.create({
            email: `buyer-${buyerUuid}@test.com`,
            password: 'testpass123',
            roles: ['buyer'],
            isVerified: true,
          });

          // Create a product
          const product = await Product.create({
            name: `${productName}-${buyerUuid}`,
            price: 100,
            quantity: 10,
            owner: buyer._id,
          });

          // Add product to wishlist
          await WishlistItem.create({
            buyer: buyer._id,
            product: product._id,
          });

          // Remove product multiple times
          for (let i = 0; i < removeCount; i++) {
            await WishlistItem.deleteOne({
              buyer: buyer._id,
              product: product._id,
            });

            // Verify product is not in wishlist after each removal
            const count = await WishlistItem.countDocuments({
              buyer: buyer._id,
              product: product._id,
            });
            expect(count).toBe(0);
          }

          // Cleanup
          await Product.deleteOne({ _id: product._id });
          await User.deleteOne({ _id: buyer._id });
        }
      ),
      { numRuns: 100 }
    );
  });
});
