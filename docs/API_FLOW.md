# Tractive API Flow (Frontend Reference)

This document describes how the main resources relate and the typical request flow for the frontend.

## Core Resources and Relationships

- Product: Item listed by an agent/admin (seller).
- Bid: Optional negotiation initiated by a buyer for a product.
- Order: Purchase record created at checkout (direct buy or after bid accepted).
- Transaction: Payment record tied to an order.

## Role Mapping (Important)

- Seller = Agent
- Buyer = Buyer
- Farmer = Created/managed by an agent
- Admin = Platform admin

Relationship summary:
- Product -> (optional) Bid -> Order -> Transaction
- An Order references one or more Products.
- A Transaction references exactly one Order.

## Authentication and Roles (Active Role)

- Users register without a role, then add/select a role via /api/auth/add-account.
- activeRole determines what actions the user can perform.
- Refresh token flow keeps sessions alive; logout revokes refresh tokens.

Endpoints:
- POST /api/auth/register
- POST /api/auth/verify-code
- POST /api/auth/login
- POST /api/auth/add-account
- PATCH /api/profile/switch-role
- POST /api/auth/refresh
- POST /api/auth/logout

Common profile fields in onboarding/profile update include:
- image, bio
- bankName, bankAccountName, bankAccountNumber

Refresh token storage:
- The backend now sets refreshToken as an httpOnly cookie on login and refresh.
- Frontend can call /api/auth/refresh without a body when using cookie storage.

## Products (Agent/Admin)

Create a product
- POST /api/products
- Required: name, price
- Optional: description, quantity, unit, categories, images (URLs), videos (URLs), farmer, discount

List products
- GET /api/products?page=1&limit=20
- Filters: search, status, category, farmer, owner, minPrice, maxPrice, from, to
- Sorting: sortBy, sortOrder
- Media: includeMedia=true|false

Update product
- PATCH /api/products/{id}
- PUT /api/products/{id} (alias to PATCH)
- Status update: PATCH /api/products/{id}/status
- Product bids: GET /api/products/{id}/bids
- Similar products: GET /api/products/{id}/similar

Bulk
- POST /api/products/bulk/delete
- PATCH /api/products/bulk/status

## Bids (Buyer)

Create bid
- POST /api/bids
- Body: { productId, amount, quantity?, message? }

List bids
- GET /api/bids?page=1&limit=20
- Buyer activeRole -> bids where buyer = user
- Agent activeRole -> bids where agent = user

Buyer namespace
- POST /api/buyers/products/{productId}/bid
- GET /api/buyers/biddings
- GET /api/buyers/biddings/won
- GET /api/buyers/biddings/won/checkout

## Orders

Create order (buyer)
- POST /api/orders
- Body: { products: [{ product, quantity }], totalAmount, address }
  - If created from accepted bids, include bidIds to enforce server validation.
  - Use Idempotency-Key header to avoid duplicate orders on retries.

List orders
- GET /api/orders?page=1&limit=20

Update order status
- PATCH /api/orders/{id}/status

Parties
- GET /api/orders/{id}/parties

Find transporters after payment initiation
- GET /api/orders/{id}/transporters
- Available when order is `paid`/`delivered` OR a pending payment transaction exists (manual approval flow)
- Buyer can fetch only for own order; agent/admin can fetch for any order

## Transactions

Create transaction
- POST /api/transactions
- Body: { order, amount, paymentMethod? }

List transactions
- GET /api/transactions?page=1&limit=20

Update transaction status (admin)
- PATCH /api/transactions/{id}/status

Customer care
- POST /api/transactions/{id}/contact-customer-care

## Farmers (Agent/Admin)

Create farmer
- POST /api/farmers
- Required: name, phone, address, state, lga, villageOrLocalMarket
- Optional: bankName, bankAccountName, bankAccountNumber

List farmers
- GET /api/farmers?page=1&limit=20
- Filters: search, year, month
- Response includes revenue + ordersCount

Farmer stats
- GET /api/farmers/revenue
- GET /api/farmers/orders
- GET /api/farmers/{id}/revenue
- GET /api/farmers/{id}/orders

Update farmer
- PUT /api/farmers/{id} (full replace)
- PATCH /api/farmers/{id} (partial)

## Buyers Namespace

Discovery
- GET /api/buyers/top-sellers
- GET /api/buyers/top-selling
- GET /api/buyers/recommendations

Categories
- GET /api/buyers/categories/{categoryId}/{subcategoryId}/farmers

Wishlist
- GET /api/buyers/wishlist
- POST /api/buyers/wishlist/{productId}
- DELETE /api/buyers/wishlist/{productId}

Follow seller (agent)
- POST /api/buyers/sellers/{sellerId}/follow
- DELETE /api/buyers/sellers/{sellerId}/follow
- Canonical endpoint for product-page seller follow/unfollow.

## Sellers Namespace

- GET /api/sellers
- GET /api/sellers/{id}
- GET /api/sellers/{id}/products
- GET /api/sellers/{id}/reviews
- GET /api/sellers/{id}/recommendations
- GET /api/sellers/products/{id}

## Transporters

Marketplace
- GET /api/transporters
- POST /api/transporters
- GET /api/transporters/{id}
- GET /api/transporters/{id}/reviews
- GET /api/transporters/trucks
- GET /api/transporters/trucks/empty
- GET /api/transporters/trucks/almost-full
- GET /api/transporters/trucks/{id}
- GET /api/transporters/recommendations
- GET /api/transporters/reviews

Fleet & Drivers (activeRole=transporter)
- GET/POST /api/transporters/fleet
- PATCH /api/transporters/fleet/{id}
- PATCH /api/transporters/fleet/{id}/status
- DELETE /api/transporters/fleet/{id}
- GET/POST /api/transporters/fleets (alias of /fleet)
- PATCH/DELETE /api/transporters/fleets/{id} (alias of /fleet/{id})
- PATCH /api/transporters/fleets/{id}/status (alias of /fleet/{id}/status)
- GET/POST /api/transporters/drivers
  - Driver create supports either name/phone or fullName/phoneNumber
- PATCH /api/transporters/drivers/{id}
- POST /api/transporters/drivers/{id}/assign-fleet
- DELETE /api/transporters/drivers/{id}

Orders & tracking
- GET /api/transporters/orders/{orderId}/tracking
- PATCH /api/transporters/orders/{orderId}/status
- GET /api/transporters/orders/{orderId}/buyer
- GET /api/transporters/orders/{orderId}/product

## Admin

Dashboard
- GET /api/admin/dashboard
- GET /api/admin/dashboard/registered-users
- GET /api/admin/dashboard/received-payments
- GET /api/admin/dashboard/orders
- GET /api/admin/dashboard/visitors
- GET /api/admin/dashboard/revenue-chart

Top lists
- GET /api/admin/top-buyers
- GET /api/admin/top-agents
- GET /api/admin/top-transporters

Users
- GET /api/admin/users
- GET /api/admin/users/{id}
- PATCH /api/admin/users/{id}
- PATCH /api/admin/users/{id}/status
- POST /api/admin/users/{id}/reactivate
- POST /api/admin/users/{id}/onboard
- GET /api/admin/users/removed
- GET /api/admin/users/stats

Approvals
- GET/PATCH /api/admin/approvals/agents
- GET/PATCH /api/admin/approvals/farmers
- PATCH /api/admin/approvals/agents/{id}
- PATCH /api/admin/approvals/farmers/{id}

Transactions
- GET /api/admin/transactions
- POST /api/admin/transactions/refund
- POST /api/admin/transactions/{id}/refund

Support
- GET /api/admin/queries
- PATCH /api/admin/queries/{id}/status
- POST /api/admin/queries/{id}/reply
- DELETE /api/admin/queries/{id}

Live Chats
- GET /api/admin/live-chats
- GET /api/admin/live-chats/{conversationId}
- POST /api/admin/live-chats/{conversationId}/messages
- PATCH /api/admin/live-chats/{conversationId}/close
- DELETE /api/admin/live-chats/{conversationId}

## Notes

- All responses follow: { success, data, message } for most new endpoints.
- Some legacy routes may return { error } or { item } — frontend should handle both during transition.
- OpenAPI source of truth: docs/openapi.yaml (served at /api-docs).

## Buyer Bid -> Transaction Flow

1) Buyer places a bid
   - POST /api/bids (or POST /api/buyers/products/{productId}/bid)

2) Agent accepts the bid
   - PATCH /api/bids/{id} with { status: "accepted" }

3) Buyer sees accepted bids
   - GET /api/buyers/biddings/won

4) Buyer gets checkout summary
   - GET /api/buyers/biddings/won/checkout
   - Returns accepted bids + totalAmount.

5) Buyer creates order
   - POST /api/orders
   - Include bidIds and totalAmount to enforce server validation.

6) Buyer makes payment (transaction)
   - POST /api/transactions
   - This is the actual payment step tied to the order.

Payment point:
- Payment happens at transaction creation.
- The order is created first, then paid via transaction.
