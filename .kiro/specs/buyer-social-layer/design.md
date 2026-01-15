# Design Document

## Overview

The Buyer Social Layer extends the Tractive platform with social and personalization features that enhance buyer engagement and product discovery. This feature set includes wishlist management, farmer following, top sellers and trending products discovery, personalized recommendations, and enhanced review interactions (replies and likes).

The design follows the existing Next.js App Router architecture, utilizing JWT-based authentication, MongoDB with Mongoose ODM, and RESTful API patterns already established in the codebase. All new endpoints will integrate seamlessly with existing middleware for CORS, authentication, and error handling.

## Architecture

### High-Level Architecture

The Buyer Social Layer follows a three-tier architecture:

1. **API Layer** (`src/app/api/*`): Next.js App Router handlers for HTTP requests
2. **Business Logic Layer**: Embedded within route handlers, following existing patterns
3. **Data Layer** (`src/models/*`): Mongoose models for MongoDB collections

### Component Interaction Flow

```
Client Request
    ↓
Next.js Middleware (CORS)
    ↓
API Route Handler
    ↓
JWT Authentication Check
    ↓
Role Authorization Check
    ↓
Input Validation
    ↓
Database Connection (dbConnect)
    ↓
Mongoose Model Operations
    ↓
Response Formatting
    ↓
Client Response
```

### Technology Stack

- **Runtime**: Node.js with Next.js 14+ App Router
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken library)
- **Validation**: Manual validation following existing patterns
- **API Style**: RESTful with JSON responses

## Components and Interfaces

### 1. Wishlist Module

**Model**: `WishlistItem` (`src/models/wishlist.ts`)

**Schema**:
```typescript
{
  buyer: ObjectId (ref: 'User', required, indexed)
  product: ObjectId (ref: 'Product', required, indexed)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

**Unique Constraint**: Compound index on `(buyer, product)` to prevent duplicates

**API Routes**: `src/app/api/wishlist/route.ts`

- `GET /api/wishlist` - Retrieve buyer's wishlist
- `POST /api/wishlist` - Add product to wishlist
- `DELETE /api/wishlist` - Remove product from wishlist

### 2. Farmer Follow Module

**Model**: `FarmerFollow` (`src/models/farmerFollow.ts`)

**Schema**:
```typescript
{
  buyer: ObjectId (ref: 'User', required, indexed)
  farmer: ObjectId (ref: 'Farmer', required, indexed)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

**Unique Constraint**: Compound index on `(buyer, farmer)` to prevent duplicates

**API Routes**: `src/app/api/follow/route.ts`

- `GET /api/follow` - List followed farmers
- `POST /api/follow` - Follow a farmer
- `DELETE /api/follow` - Unfollow a farmer

### 3. Top Sellers Module

**API Routes**: `src/app/api/top-sellers/route.ts`

- `GET /api/top-sellers` - Retrieve top 10 sellers by performance

**Algorithm**:
1. Aggregate orders by product owner (agent/farmer)
2. Calculate metrics: total orders, total revenue
3. Sort by total revenue (descending)
4. Return top 10 with seller details

### 4. Trending Products Module

**API Routes**: `src/app/api/trending-products/route.ts`

- `GET /api/trending-products` - Retrieve top 10 trending products

**Algorithm**:
1. Aggregate recent orders (last 30 days) by product
2. Aggregate recent bids (last 30 days) by product
3. Calculate engagement score: (order_count * 2) + bid_count
4. Sort by engagement score (descending)
5. Return top 10 with product details
6. Fallback: If no engagement data, return 10 most recent products

### 5. Recommendations Module

**API Routes**: `src/app/api/recommendations/route.ts`

- `GET /api/recommendations` - Get personalized product recommendations

**Algorithm**:
1. Extract categories from buyer's past orders
2. Extract categories from buyer's wishlist items
3. Get products from followed farmers
4. Combine and deduplicate categories
5. Query products matching these categories (limit 20)
6. Exclude products already purchased or in wishlist
7. Fallback: If no personalization data, return trending products

### 6. Enhanced Reviews Module

**Model Extension**: `Review` (`src/models/review.ts` - to be modified)

**New Fields**:
```typescript
{
  // Existing fields remain unchanged
  replies: [{
    author: ObjectId (ref: 'User', required)
    message: String (required)
    createdAt: Date (required)
  }]
  likes: [ObjectId] (ref: 'User', array of buyer IDs)
}
```

**API Routes**: 
- `src/app/api/reviews/[id]/reply/route.ts`
  - `POST /api/reviews/:id/reply` - Add reply to review

- `src/app/api/reviews/[id]/like/route.ts`
  - `POST /api/reviews/:id/like` - Toggle like on review

## Data Models

### WishlistItem Model

```typescript
import mongoose from 'mongoose';

const WishlistItemSchema = new mongoose.Schema({
  buyer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true,
    index: true
  }
}, { 
  timestamps: true 
});

// Unique compound index
WishlistItemSchema.index({ buyer: 1, product: 1 }, { unique: true });

export default mongoose.models.WishlistItem || 
  mongoose.model('WishlistItem', WishlistItemSchema);
```

### FarmerFollow Model

```typescript
import mongoose from 'mongoose';

const FarmerFollowSchema = new mongoose.Schema({
  buyer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  farmer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Farmer', 
    required: true,
    index: true
  }
}, { 
  timestamps: true 
});

// Unique compound index
FarmerFollowSchema.index({ buyer: 1, farmer: 1 }, { unique: true });

export default mongoose.models.FarmerFollow || 
  mongoose.model('FarmerFollow', FarmerFollowSchema);
```

### Review Model Extension

```typescript
// Add to existing Review model
const ReviewSchema = new mongoose.Schema({
  // ... existing fields ...
  replies: [{
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    message: { 
      type: String, 
      required: true 
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  likes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }]
});
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Wishlist uniqueness preservation

*For any* buyer and product combination, adding the same product to the wishlist multiple times should result in exactly one wishlist entry.

**Validates: Requirements 1.2**

### Property 2: Wishlist item retrieval completeness

*For any* buyer with wishlist items, retrieving the wishlist should return all and only the products that buyer has added.

**Validates: Requirements 1.3**

### Property 3: Wishlist removal idempotence

*For any* wishlist item, removing it once or multiple times should result in the same state: the item not being in the wishlist.

**Validates: Requirements 1.4**

### Property 4: Follow relationship uniqueness

*For any* buyer and farmer combination, following the same farmer multiple times should result in exactly one follow relationship.

**Validates: Requirements 2.2**

### Property 5: Follow list completeness

*For any* buyer with follow relationships, retrieving followed farmers should return all and only the farmers that buyer follows.

**Validates: Requirements 2.4**

### Property 6: Unfollow idempotence

*For any* follow relationship, unfollowing once or multiple times should result in the same state: no follow relationship exists.

**Validates: Requirements 2.3**

### Property 7: Top sellers ranking consistency

*For any* set of orders, the top sellers list should be ordered by revenue in descending order, and recalculating should produce the same ranking.

**Validates: Requirements 3.1, 3.2**

### Property 8: Trending products engagement correlation

*For any* set of products with engagement data, products with higher engagement scores should rank higher in the trending list.

**Validates: Requirements 4.1, 4.2**

### Property 9: Recommendation relevance

*For any* buyer with interaction history, recommended products should match at least one category from their orders, wishlist, or followed farmers.

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 10: Recommendation fallback consistency

*For any* buyer with no interaction history, recommendations should return the same products as the trending products endpoint.

**Validates: Requirements 5.5**

### Property 11: Review reply append-only

*For any* review, adding replies should only append to the replies array without modifying existing replies or other review fields.

**Validates: Requirements 6.1, 6.2**

### Property 12: Review like toggle symmetry

*For any* buyer and review, liking twice should result in the buyer's ID being removed from the likes array (toggle behavior).

**Validates: Requirements 7.2**

### Property 13: Authentication requirement universality

*For any* protected endpoint (wishlist, follow, recommendations, review interactions), requests without valid JWT tokens should be rejected with 401 status.

**Validates: Requirements 1.6, 2.6, 5.6, 6.5, 7.5**

### Property 14: Role authorization enforcement

*For any* buyer-only endpoint, requests from users without the buyer role should be rejected with 403 status.

**Validates: Requirements 1.7, 2.7, 5.7, 6.6, 7.6**

### Property 15: Entity existence validation

*For any* operation referencing related entities (products, farmers, reviews), the system should verify entity existence before creating relationships.

**Validates: Requirements 1.5, 2.5, 6.4, 7.4, 8.4**

## Error Handling

### Error Response Format

All errors follow the existing pattern:

```typescript
{
  error: string  // Human-readable error message
}
```

### HTTP Status Codes

- `200 OK` - Successful GET request
- `201 Created` - Successful POST request creating a resource
- `400 Bad Request` - Invalid input or validation failure
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - Insufficient permissions (role check failure)
- `404 Not Found` - Referenced entity does not exist
- `409 Conflict` - Duplicate entry (unique constraint violation)
- `500 Internal Server Error` - Unexpected server error

### Error Scenarios

1. **Authentication Errors**
   - Missing Authorization header → 401
   - Invalid JWT token → 401
   - Expired JWT token → 401

2. **Authorization Errors**
   - Non-buyer accessing buyer-only endpoint → 403
   - Non-agent/transporter replying to review → 403

3. **Validation Errors**
   - Missing required fields → 400
   - Invalid ObjectId format → 400
   - Invalid data types → 400

4. **Resource Errors**
   - Product not found → 404
   - Farmer not found → 404
   - Review not found → 404

5. **Constraint Errors**
   - Duplicate wishlist entry → 409 (caught and handled gracefully)
   - Duplicate follow relationship → 409 (caught and handled gracefully)

### Error Handling Strategy

```typescript
try {
  // Operation
} catch (error) {
  if (error.code === 11000) {
    // Duplicate key error - handle gracefully
    return NextResponse.json(
      { error: 'Already exists' }, 
      { status: 409 }
    );
  }
  // Log unexpected errors
  console.error('Unexpected error:', error);
  return NextResponse.json(
    { error: 'Internal server error' }, 
    { status: 500 }
  );
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific behaviors and edge cases:

1. **Wishlist Tests**
   - Adding a product to an empty wishlist
   - Removing the last item from a wishlist
   - Attempting to add invalid product ID
   - Attempting to remove non-existent item

2. **Follow Tests**
   - Following a farmer for the first time
   - Unfollowing the last followed farmer
   - Attempting to follow invalid farmer ID
   - Attempting to unfollow non-followed farmer

3. **Discovery Tests**
   - Top sellers with no orders
   - Trending products with no engagement
   - Recommendations with no user history

4. **Review Interaction Tests**
   - Adding first reply to a review
   - Liking a review with no existing likes
   - Unliking a review (toggle off)
   - Agent replying to their own review

### Property-Based Testing

Property-based tests will verify universal properties across many inputs using **fast-check** (JavaScript/TypeScript PBT library).

**Configuration**: Each property test will run a minimum of 100 iterations.

**Test Tagging**: Each property-based test will include a comment with this format:
```typescript
// Feature: buyer-social-layer, Property 1: Wishlist uniqueness preservation
```

#### Property Test 1: Wishlist Uniqueness
```typescript
// Feature: buyer-social-layer, Property 1: Wishlist uniqueness preservation
// Validates: Requirements 1.2
```
- Generate random buyer ID and product ID
- Add to wishlist multiple times
- Verify only one entry exists in database

#### Property Test 2: Wishlist Retrieval Completeness
```typescript
// Feature: buyer-social-layer, Property 2: Wishlist item retrieval completeness
// Validates: Requirements 1.3
```
- Generate random buyer ID and array of product IDs
- Add all products to wishlist
- Retrieve wishlist
- Verify returned products match exactly what was added

#### Property Test 3: Wishlist Removal Idempotence
```typescript
// Feature: buyer-social-layer, Property 3: Wishlist removal idempotence
// Validates: Requirements 1.4
```
- Generate random buyer ID and product ID
- Add product to wishlist
- Remove product multiple times
- Verify product is not in wishlist after each removal

#### Property Test 4: Follow Uniqueness
```typescript
// Feature: buyer-social-layer, Property 4: Follow relationship uniqueness
// Validates: Requirements 2.2
```
- Generate random buyer ID and farmer ID
- Follow farmer multiple times
- Verify only one follow relationship exists

#### Property Test 5: Follow List Completeness
```typescript
// Feature: buyer-social-layer, Property 5: Follow list completeness
// Validates: Requirements 2.4
```
- Generate random buyer ID and array of farmer IDs
- Follow all farmers
- Retrieve followed farmers
- Verify returned farmers match exactly what was followed

#### Property Test 6: Unfollow Idempotence
```typescript
// Feature: buyer-social-layer, Property 6: Unfollow idempotence
// Validates: Requirements 2.3
```
- Generate random buyer ID and farmer ID
- Follow farmer
- Unfollow multiple times
- Verify no follow relationship exists after each unfollow

#### Property Test 7: Top Sellers Ranking
```typescript
// Feature: buyer-social-layer, Property 7: Top sellers ranking consistency
// Validates: Requirements 3.1, 3.2
```
- Generate random orders with varying amounts
- Calculate top sellers
- Verify sellers are ordered by revenue descending
- Recalculate and verify same ranking

#### Property Test 8: Trending Products Engagement
```typescript
// Feature: buyer-social-layer, Property 8: Trending products engagement correlation
// Validates: Requirements 4.1, 4.2
```
- Generate random products with varying engagement
- Calculate trending products
- Verify products are ordered by engagement score descending

#### Property Test 9: Recommendation Relevance
```typescript
// Feature: buyer-social-layer, Property 9: Recommendation relevance
// Validates: Requirements 5.2, 5.3, 5.4
```
- Generate random buyer with orders and wishlist
- Generate random products with categories
- Get recommendations
- Verify all recommended products match buyer's category preferences

#### Property Test 10: Recommendation Fallback
```typescript
// Feature: buyer-social-layer, Property 10: Recommendation fallback consistency
// Validates: Requirements 5.5
```
- Generate buyer with no interaction history
- Get recommendations
- Get trending products
- Verify recommendations match trending products

#### Property Test 11: Review Reply Append-Only
```typescript
// Feature: buyer-social-layer, Property 11: Review reply append-only
// Validates: Requirements 6.1, 6.2
```
- Generate random review with existing replies
- Add new reply
- Verify new reply is appended
- Verify existing replies unchanged
- Verify other review fields unchanged

#### Property Test 12: Review Like Toggle
```typescript
// Feature: buyer-social-layer, Property 12: Review like toggle symmetry
// Validates: Requirements 7.2
```
- Generate random buyer ID and review
- Like review (buyer ID added)
- Like again (buyer ID removed)
- Verify toggle behavior

#### Property Test 13: Authentication Requirement
```typescript
// Feature: buyer-social-layer, Property 13: Authentication requirement universality
// Validates: Requirements 1.6, 2.6, 5.6, 6.5, 7.5
```
- Generate requests to all protected endpoints
- Send without authentication token
- Verify all return 401 status

#### Property Test 14: Role Authorization
```typescript
// Feature: buyer-social-layer, Property 14: Role authorization enforcement
// Validates: Requirements 1.7, 2.7, 5.7, 6.6, 7.6
```
- Generate users with non-buyer roles
- Attempt buyer-only operations
- Verify all return 403 status

#### Property Test 15: Entity Existence Validation
```typescript
// Feature: buyer-social-layer, Property 15: Entity existence validation
// Validates: Requirements 1.5, 2.5, 6.4, 7.4, 8.4
```
- Generate random non-existent IDs
- Attempt operations referencing these IDs
- Verify all return 404 status

### Integration Testing

Integration tests will verify end-to-end workflows:

1. Complete wishlist workflow (add → retrieve → remove)
2. Complete follow workflow (follow → list → unfollow)
3. Discovery workflow (view top sellers → view trending → get recommendations)
4. Review interaction workflow (create review → add reply → like review)

### Test Utilities

Shared test utilities will be created:

- `createTestBuyer()` - Create authenticated buyer for testing
- `createTestProduct()` - Create test product
- `createTestFarmer()` - Create test farmer
- `createTestReview()` - Create test review
- `cleanupTestData()` - Remove test data after tests

## Security Considerations

1. **Authentication**: All protected endpoints verify JWT tokens
2. **Authorization**: Role-based access control enforced
3. **Input Validation**: All user inputs validated before processing
4. **SQL Injection Prevention**: Mongoose ODM provides protection
5. **Rate Limiting**: Consider adding rate limiting for public endpoints (future enhancement)
6. **Data Privacy**: Users can only access their own wishlist and follow data

## Performance Considerations

1. **Database Indexes**: Compound indexes on frequently queried fields
2. **Pagination**: Consider adding pagination for large result sets (future enhancement)
3. **Caching**: Consider caching trending products and top sellers (future enhancement)
4. **Query Optimization**: Use lean() for read-only queries
5. **Aggregation Pipelines**: Efficient aggregation for analytics queries

## Future Enhancements

1. Real-time notifications when followed farmers add new products
2. Advanced recommendation algorithms using machine learning
3. Social features: buyer-to-buyer interactions, product sharing
4. Analytics dashboard for buyers to track their engagement
5. Wishlist sharing and collaborative wishlists
6. Follow suggestions based on similar buyers
