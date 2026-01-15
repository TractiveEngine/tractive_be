# Implementation Plan

- [x] 1. Create Wishlist data model and API endpoints



  - Create Mongoose model with unique compound index for buyer-product pairs
  - Implement GET endpoint to retrieve buyer's wishlist with populated product details
  - Implement POST endpoint to add products with existence validation
  - Implement DELETE endpoint to remove products
  - Add authentication and buyer role checks to all endpoints
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 1.1 Write property test for wishlist uniqueness

  - **Property 1: Wishlist uniqueness preservation**
  - **Validates: Requirements 1.2**


- [ ] 1.2 Write property test for wishlist retrieval completeness
  - **Property 2: Wishlist item retrieval completeness**
  - **Validates: Requirements 1.3**


- [ ] 1.3 Write property test for wishlist removal idempotence
  - **Property 3: Wishlist removal idempotence**
  - **Validates: Requirements 1.4**

- [ ] 2. Create Farmer Follow data model and API endpoints
  - Create Mongoose model with unique compound index for buyer-farmer pairs
  - Implement GET endpoint to list followed farmers with populated farmer details
  - Implement POST endpoint to follow farmers with existence validation
  - Implement DELETE endpoint to unfollow farmers
  - Add authentication and buyer role checks to all endpoints
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 2.1 Write property test for follow relationship uniqueness
  - **Property 4: Follow relationship uniqueness**
  - **Validates: Requirements 2.2**

- [ ] 2.2 Write property test for follow list completeness
  - **Property 5: Follow list completeness**
  - **Validates: Requirements 2.4**

- [ ] 2.3 Write property test for unfollow idempotence
  - **Property 6: Unfollow idempotence**
  - **Validates: Requirements 2.3**

- [ ] 3. Implement Top Sellers discovery endpoint
  - Create API route for top sellers
  - Implement aggregation pipeline to group orders by product owner
  - Calculate total orders and revenue per seller
  - Sort by revenue and limit to top 10
  - Populate seller details (user/farmer information)
  - Handle empty results gracefully
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3.1 Write property test for top sellers ranking consistency
  - **Property 7: Top sellers ranking consistency**
  - **Validates: Requirements 3.1, 3.2**

- [ ] 4. Implement Trending Products discovery endpoint
  - Create API route for trending products
  - Implement aggregation pipeline for recent orders (last 30 days)
  - Implement aggregation pipeline for recent bids (last 30 days)
  - Calculate engagement score: (order_count * 2) + bid_count
  - Sort by engagement score and limit to top 10
  - Implement fallback to recent products when no engagement data exists
  - Populate complete product details
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 4.1 Write property test for trending products engagement correlation
  - **Property 8: Trending products engagement correlation**
  - **Validates: Requirements 4.1, 4.2**

- [ ] 5. Implement Personalized Recommendations endpoint
  - Create API route for recommendations
  - Extract categories from buyer's past orders
  - Extract categories from buyer's wishlist items
  - Get product IDs from followed farmers
  - Combine and deduplicate categories
  - Query products matching categories (limit 20)
  - Exclude already purchased products and wishlist items
  - Implement fallback to trending products for new buyers
  - Add authentication and buyer role checks
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 5.1 Write property test for recommendation relevance
  - **Property 9: Recommendation relevance**
  - **Validates: Requirements 5.2, 5.3, 5.4**

- [ ] 5.2 Write property test for recommendation fallback consistency
  - **Property 10: Recommendation fallback consistency**
  - **Validates: Requirements 5.5**

- [ ] 6. Extend Review model with replies and likes
  - Modify existing Review model to add replies array field
  - Add likes array field to Review model
  - Ensure backward compatibility with existing reviews
  - Update Review model export
  - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3_

- [ ] 7. Implement Review Reply endpoint
  - Create API route for adding replies to reviews
  - Verify review exists before adding reply
  - Check that replier is the reviewed agent or transporter
  - Append reply object with author, message, and timestamp
  - Add authentication check
  - Prevent buyers from replying
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 7.1 Write property test for review reply append-only behavior
  - **Property 11: Review reply append-only**
  - **Validates: Requirements 6.1, 6.2**

- [ ] 8. Implement Review Like endpoint
  - Create API route for toggling likes on reviews
  - Verify review exists before processing like
  - Implement toggle logic: add if not present, remove if present
  - Add authentication and buyer role checks
  - Return updated like count in response
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 8.1 Write property test for review like toggle symmetry
  - **Property 12: Review like toggle symmetry**
  - **Validates: Requirements 7.2**

- [ ] 9. Add comprehensive input validation and error handling
  - Validate ObjectId format for all ID parameters
  - Add descriptive error messages for all failure scenarios
  - Implement proper HTTP status codes (400, 401, 403, 404, 409, 500)
  - Handle MongoDB duplicate key errors gracefully
  - Add try-catch blocks for unexpected errors
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 9.1 Write property test for authentication requirement universality
  - **Property 13: Authentication requirement universality**
  - **Validates: Requirements 1.6, 2.6, 5.6, 6.5, 7.5**

- [ ] 9.2 Write property test for role authorization enforcement
  - **Property 14: Role authorization enforcement**
  - **Validates: Requirements 1.7, 2.7, 5.7, 6.6, 7.6**

- [ ] 9.3 Write property test for entity existence validation
  - **Property 15: Entity existence validation**
  - **Validates: Requirements 1.5, 2.5, 6.4, 7.4, 8.4**

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Create test utilities and integration tests
  - Create helper functions for test data generation
  - Write integration test for complete wishlist workflow
  - Write integration test for complete follow workflow
  - Write integration test for discovery workflow
  - Write integration test for review interaction workflow
  - Add cleanup utilities for test data
