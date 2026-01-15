# Tractive Backend Testing Setup

## Overview
Complete automated testing environment for the Tractive backend using Vitest + Supertest.

## Current Status
✅ **Testing Framework**: Fully configured with Vitest + Supertest  
✅ **Database Setup**: Test database connection and cleanup utilities  
✅ **Test Server Helpers**: Mock request creation and authentication  
✅ **Factory Helpers**: Complete set of factories for all models  
✅ **Seed Script**: Comprehensive database seeding with demo data  
✅ **Reset Script**: Database cleanup utility  
✅ **Email Mocking**: Email sending disabled in test environment  

## Test Results (Latest Run)
✅ **ALL 8 TESTS PASSING!** 🎉

### Test Suite Results
**Auth Flow Tests (3/3 passing):**
1. ✅ should complete full auth flow: register → verify → login → profile
2. ✅ should reject login with incorrect password
3. ✅ should reject profile access without token

**Product CRUD Tests (3/3 passing):**
1. ✅ should allow agent to create, list, update, and delete products
2. ✅ should prevent buyer from creating products
3. ✅ should require authentication to create products

**Order-Transaction-Notification Flow Tests (2/2 passing):**
1. ✅ should create order, approve transaction, and generate notification
2. ✅ should prevent non-admin from approving transactions

**Test Duration:** ~40 seconds for full suite

## Project Structure
```
tests/
├── setup/
│   ├── db.ts                 # Database connection & cleanup
│   ├── test-server.ts        # Request helpers & authentication
│   └── vitest.setup.ts       # Test environment configuration
├── factories/
│   ├── user.factory.ts       # User creation (all roles)
│   ├── product.factory.ts    # Product creation
│   ├── farmer.factory.ts     # Farmer creation
│   ├── order.factory.ts      # Order creation
│   ├── transaction.factory.ts # Transaction creation
│   ├── notification.factory.ts # Notification creation
│   ├── truck.factory.ts      # Truck creation
│   ├── driver.factory.ts     # Driver creation
│   ├── shipping.factory.ts   # Shipping request creation
│   ├── negotiation.factory.ts # Negotiation creation
│   ├── bid.factory.ts        # Bid creation
│   ├── wishlist.factory.ts   # Wishlist creation
│   ├── review.factory.ts     # Review creation
│   ├── supportTicket.factory.ts # Support ticket creation
│   └── index.ts              # Factory exports
└── api/
    ├── auth.test.ts          # Authentication flow tests
    ├── products.test.ts      # Product CRUD tests
    └── order-transaction-notification.test.ts # Order flow tests
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Seed database with demo data
```bash
npm run seed
```

### Reset database (clear all data)
```bash
npm run reset
```

## Configuration

### Environment Variables
Tests use `MONGODB_URI_TEST` for the test database:
```env
MONGODB_URI_TEST="mongodb+srv://agent:6mLBsjMMRoHzgfq8@ai.xlusxlw.mongodb.net/agric-test?retryWrites=true&w=majority"
```

### Vitest Configuration
- **Test timeout**: 30 seconds
- **Hook timeout**: 30 seconds
- **Execution**: Sequential (single fork)
- **Environment**: Node
- **PostCSS**: Disabled for tests

## Factory Usage Examples

### Create a user
```typescript
import { createBuyer, createAgent, createAdmin } from '../factories';

const { user, token } = await createBuyer({
  email: 'buyer@example.com',
  name: 'Test Buyer',
});
```

### Create products
```typescript
import { createProducts } from '../factories';

const products = await createProducts(5, agentId, {
  categories: ['grain', 'vegetables'],
});
```

### Create orders
```typescript
import { createOrders } from '../factories';

const orders = await createOrders(
  1,
  buyerId,
  [{ product: productId, quantity: 10 }],
  { status: 'paid' }
);
```

## Test Helpers

### Create authenticated request
```typescript
import { createAuthenticatedRequest } from '../setup/test-server';

const request = createAuthenticatedRequest(
  'http://localhost:3000/api/products',
  userId,
  {
    method: 'POST',
    body: { name: 'Product', price: 5000 },
    email: 'user@example.com',
    role: 'agent',
  }
);
```

### Call route handler
```typescript
import { callRouteHandler, getResponseJson } from '../setup/test-server';

const response = await handler(request);
const data = await getResponseJson(response);
```

## Recent Fixes Applied

### API Endpoint Fixes
1. ✅ **Verify endpoint**: Added `message` field to response
2. ✅ **Notifications endpoint**: Flattened response structure to match test expectations
3. ✅ **Database cleanup**: Optimized to run in parallel for faster execution

### Performance Optimizations
1. ✅ Email sending mocked in test environment
2. ✅ SMTP verification skipped in test environment
3. ✅ Database cleanup runs in parallel
4. ✅ Tests run sequentially to avoid conflicts

## Next Steps & Improvements

### Recommended Enhancements
1. Add more edge case tests (invalid inputs, boundary conditions)
2. Add property-based tests using fast-check (already installed)
3. Add integration tests for complex workflows
4. Add API response schema validation
5. Add performance benchmarks
6. Add test coverage reporting
7. Add CI/CD integration

## Notes
- Email sending is mocked in test environment
- Tests run sequentially to avoid database conflicts
- Database is cleared before each test
- JWT tokens are generated for authenticated requests
- All factories use real Mongoose models
