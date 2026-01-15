# Requirements Document

## Introduction

The Buyer Social Layer feature enhances the Tractive platform by adding social and personalization capabilities for buyers. This feature enables buyers to create wishlists, follow farmers, discover trending products and top sellers, receive personalized recommendations, and engage more deeply with reviews through replies and likes. The goal is to increase buyer engagement, facilitate product discovery, and build stronger connections between buyers and farmers/agents.

## Glossary

- **Tractive System**: The agricultural marketplace platform connecting buyers, agents, farmers, and transporters
- **Buyer**: A user with the "buyer" role who purchases agricultural products
- **Farmer**: An agricultural producer whose profile is managed by agents
- **Agent**: A user who manages farmer profiles and product listings
- **Wishlist**: A collection of products that a buyer has saved for future reference
- **Follow**: A relationship where a buyer subscribes to updates from a specific farmer
- **Top Seller**: An agent or farmer ranked by order volume or revenue
- **Trending Product**: A product with high recent engagement (orders or bids)
- **Recommendation**: A product suggestion based on buyer behavior and preferences
- **Review**: A rating and comment from a buyer about an agent or transporter
- **Review Reply**: A response from an agent or transporter to a review
- **Review Like**: An endorsement of a review by a buyer

## Requirements

### Requirement 1: Wishlist Management

**User Story:** As a buyer, I want to save products to a wishlist, so that I can easily find and purchase them later.

#### Acceptance Criteria

1. WHEN a buyer adds a product to their wishlist THEN the Tractive System SHALL create a wishlist entry linking the buyer and product
2. WHEN a buyer attempts to add a product already in their wishlist THEN the Tractive System SHALL prevent duplicate entries and maintain the current state
3. WHEN a buyer requests their wishlist THEN the Tractive System SHALL return all saved products with complete product details
4. WHEN a buyer removes a product from their wishlist THEN the Tractive System SHALL delete the wishlist entry
5. WHEN a buyer attempts to add a non-existent product THEN the Tractive System SHALL reject the request and return an error
6. WHEN an unauthenticated user attempts wishlist operations THEN the Tractive System SHALL reject the request with authentication error
7. WHEN a non-buyer user attempts wishlist operations THEN the Tractive System SHALL reject the request with authorization error

### Requirement 2: Farmer Following

**User Story:** As a buyer, I want to follow farmers whose products I like, so that I can stay updated on their offerings.

#### Acceptance Criteria

1. WHEN a buyer follows a farmer THEN the Tractive System SHALL create a follow relationship between the buyer and farmer
2. WHEN a buyer attempts to follow a farmer they already follow THEN the Tractive System SHALL prevent duplicate follow relationships
3. WHEN a buyer unfollows a farmer THEN the Tractive System SHALL remove the follow relationship
4. WHEN a buyer requests their followed farmers list THEN the Tractive System SHALL return all farmers they follow with complete farmer details
5. WHEN a buyer attempts to follow a non-existent farmer THEN the Tractive System SHALL reject the request and return an error
6. WHEN an unauthenticated user attempts follow operations THEN the Tractive System SHALL reject the request with authentication error
7. WHEN a non-buyer user attempts follow operations THEN the Tractive System SHALL reject the request with authorization error

### Requirement 3: Top Sellers Discovery

**User Story:** As a buyer, I want to see top-performing sellers, so that I can purchase from reliable and popular sources.

#### Acceptance Criteria

1. WHEN a user requests top sellers THEN the Tractive System SHALL return the top 10 agents or farmers ranked by order volume or revenue
2. WHEN calculating top sellers THEN the Tractive System SHALL aggregate orders by product owner
3. WHEN displaying top sellers THEN the Tractive System SHALL include seller details and performance metrics
4. WHEN no orders exist THEN the Tractive System SHALL return an empty list
5. WHEN the request is made THEN the Tractive System SHALL allow both authenticated and unauthenticated access

### Requirement 4: Trending Products Discovery

**User Story:** As a buyer, I want to see trending products, so that I can discover popular items and make informed purchasing decisions.

#### Acceptance Criteria

1. WHEN a user requests trending products THEN the Tractive System SHALL return the top 10 products with highest recent engagement
2. WHEN calculating trending products THEN the Tractive System SHALL consider both order volume and bid activity
3. WHEN displaying trending products THEN the Tractive System SHALL include complete product details
4. WHEN no engagement data exists THEN the Tractive System SHALL return recently created products
5. WHEN the request is made THEN the Tractive System SHALL allow both authenticated and unauthenticated access

### Requirement 5: Personalized Recommendations

**User Story:** As a buyer, I want to receive personalized product recommendations, so that I can discover products relevant to my interests.

#### Acceptance Criteria

1. WHEN a buyer requests recommendations THEN the Tractive System SHALL return up to 20 products based on their behavior and preferences
2. WHEN generating recommendations THEN the Tractive System SHALL analyze the buyer's past orders for category preferences
3. WHEN generating recommendations THEN the Tractive System SHALL analyze the buyer's wishlist for category preferences
4. WHEN generating recommendations THEN the Tractive System SHALL include products from farmers the buyer follows
5. WHEN a buyer has no interaction history THEN the Tractive System SHALL return trending products as fallback recommendations
6. WHEN an unauthenticated user requests recommendations THEN the Tractive System SHALL reject the request with authentication error
7. WHEN a non-buyer user requests recommendations THEN the Tractive System SHALL reject the request with authorization error

### Requirement 6: Review Replies

**User Story:** As an agent or transporter, I want to reply to reviews, so that I can address feedback and communicate with buyers.

#### Acceptance Criteria

1. WHEN an agent or transporter replies to a review THEN the Tractive System SHALL append the reply to the review's replies array
2. WHEN adding a reply THEN the Tractive System SHALL include the author ID, message, and timestamp
3. WHEN a user who is not the reviewed party attempts to reply THEN the Tractive System SHALL reject the request with authorization error
4. WHEN replying to a non-existent review THEN the Tractive System SHALL reject the request and return an error
5. WHEN an unauthenticated user attempts to reply THEN the Tractive System SHALL reject the request with authentication error
6. WHEN a buyer attempts to reply to a review THEN the Tractive System SHALL reject the request with authorization error

### Requirement 7: Review Likes

**User Story:** As a buyer, I want to like helpful reviews, so that I can highlight valuable feedback for other buyers.

#### Acceptance Criteria

1. WHEN a buyer likes a review THEN the Tractive System SHALL add the buyer's ID to the review's likes array
2. WHEN a buyer likes a review they already liked THEN the Tractive System SHALL remove their ID from the likes array
3. WHEN displaying a review THEN the Tractive System SHALL include the count of likes
4. WHEN liking a non-existent review THEN the Tractive System SHALL reject the request and return an error
5. WHEN an unauthenticated user attempts to like a review THEN the Tractive System SHALL reject the request with authentication error
6. WHEN a non-buyer user attempts to like a review THEN the Tractive System SHALL reject the request with authorization error

### Requirement 8: Data Integrity and Validation

**User Story:** As a system administrator, I want all social layer operations to maintain data integrity, so that the platform remains reliable and consistent.

#### Acceptance Criteria

1. WHEN creating wishlist entries THEN the Tractive System SHALL enforce unique constraints on buyer-product pairs
2. WHEN creating follow relationships THEN the Tractive System SHALL enforce unique constraints on buyer-farmer pairs
3. WHEN validating object IDs THEN the Tractive System SHALL verify the ID format is valid before database queries
4. WHEN referencing related entities THEN the Tractive System SHALL verify the entities exist before creating relationships
5. WHEN an operation fails THEN the Tractive System SHALL return descriptive error messages with appropriate HTTP status codes
6. WHEN storing timestamps THEN the Tractive System SHALL use consistent date formats across all social layer features
