# 🚀 Quick Start - Manual API Testing Guide

## Prerequisites
- Postman installed (or any API testing tool)
- Backend server running on `http://localhost:3000`
- MongoDB connected

## 📥 Import Postman Collection

1. Open Postman
2. Click **Import** button
3. Select `docs/Tractive-API.postman_collection.json`
4. Collection will be imported with all endpoints

## 🎯 Complete Testing Workflow

### Phase 1: User Registration & Authentication (5 minutes)

#### Step 1: Register as Agent
```
POST /api/auth/register

Body:
{
  "name": "Test Agent",
  "email": "agent@test.com",
  "password": "TestPass123!"
}

✅ Expected: 201 Created
📝 Note: Check server console for verification code
```

#### Step 2: Verify Email
```
POST /api/auth/verify-code

Body:
{
  "email": "agent@test.com",
  "code": "123456"  // From console
}

✅ Expected: 200 OK with "Email verified successfully"
```

#### Step 3: Login
```
POST /api/auth/login

Body:
{
  "email": "agent@test.com",
  "password": "TestPass123!"
}

✅ Expected: 200 OK with JWT token
📝 IMPORTANT: Copy the token! You'll need it for all subsequent requests
```

#### Step 4: Complete Account Setup
```
POST /api/auth/add-account

Headers:
Authorization: Bearer YOUR_TOKEN_HERE

Body:
{
  "role": "agent",
  "businessName": "Test Farms Ltd",
  "villageOrLocalMarket": "Test Market",
  "phone": "+2348012345678",
  "nin": "12345678901",
  "address": "123 Test Street",
  "country": "Nigeria",
  "state": "Kaduna",
  "interests": ["Grains", "Livestock"]
}

✅ Expected: 200 OK with updated user info
```

#### Step 5: Verify Profile
```
GET /api/profile

Headers:
Authorization: Bearer YOUR_TOKEN_HERE

✅ Expected: 200 OK with complete user profile
```

---

### Phase 2: Create Farmers & Products (10 minutes)

#### Step 6: Create Farmer
```
POST /api/farmers

Headers:
Authorization: Bearer YOUR_TOKEN_HERE

Body:
{
  "name": "Test Farmer",
  "phone": "+2348055555555",
  "address": "Farm Village",
  "country": "Nigeria",
  "state": "Kaduna",
  "farmSize": "5 hectares",
  "crops": ["Maize", "Rice"]
}

✅ Expected: 201 Created
📝 Note: Save the farmer ID
```

#### Step 7: List Your Farmers
```
GET /api/farmers

Headers:
Authorization: Bearer YOUR_TOKEN_HERE

✅ Expected: 200 OK with array of farmers
```

#### Step 8: Create Product
```
POST /api/products

Headers:
Authorization: Bearer YOUR_TOKEN_HERE

Body:
{
  "name": "Fresh Maize",
  "description": "High quality yellow maize",
  "price": 5000,
  "quantity": 100,
  "unit": "kg",
  "categories": ["Grains"],
  "images": ["https://example.com/maize.jpg"],
  "farmer": "FARMER_ID_FROM_STEP_6"
}

✅ Expected: 201 Created
📝 Note: Save the product ID
```

#### Step 9: List All Products
```
GET /api/products?page=1&limit=20

✅ Expected: 200 OK with array of products
📝 Note: No authentication required for listing
```

#### Step 10: Get Single Product
```
GET /api/products/PRODUCT_ID_FROM_STEP_8

✅ Expected: 200 OK with product details
```

#### Step 11: Update Product
```
PATCH /api/products/PRODUCT_ID_FROM_STEP_8

Headers:
Authorization: Bearer YOUR_TOKEN_HERE

Body:
{
  "price": 5500,
  "quantity": 150
}

✅ Expected: 200 OK with updated product
```

---

### Phase 3: Buyer Flow - Orders & Transactions (15 minutes)

#### Step 12: Register as Buyer
```
POST /api/auth/register

Body:
{
  "name": "Test Buyer",
  "email": "buyer@test.com",
  "password": "BuyerPass123!"
}

✅ Expected: 201 Created
```

#### Step 13: Verify Buyer Email
```
POST /api/auth/verify-code

Body:
{
  "email": "buyer@test.com",
  "code": "CODE_FROM_CONSOLE"
}

✅ Expected: 200 OK
```

#### Step 14: Login as Buyer
```
POST /api/auth/login

Body:
{
  "email": "buyer@test.com",
  "password": "BuyerPass123!"
}

✅ Expected: 200 OK with JWT token
📝 IMPORTANT: Save this buyer token separately!
```

#### Step 15: Complete Buyer Account
```
POST /api/auth/add-account

Headers:
Authorization: Bearer BUYER_TOKEN_HERE

Body:
{
  "role": "buyer",
  "phone": "+2348011223344",
  "address": "456 Buyer Street",
  "country": "Nigeria",
  "state": "Lagos",
  "interests": ["Grains", "Vegetables"]
}

✅ Expected: 200 OK
```

#### Step 16: Create Order
```
POST /api/orders

Headers:
Authorization: Bearer BUYER_TOKEN_HERE

Body:
{
  "products": [
    {
      "product": "PRODUCT_ID_FROM_STEP_8",
      "quantity": 10
    }
  ],
  "totalAmount": 50000,
  "address": "123 Delivery Street, Lagos",
  "phone": "+2348011223344",
  "notes": "Please deliver in the morning"
}

✅ Expected: 201 Created
📝 Note: Save the order ID
```

#### Step 17: List Buyer's Orders
```
GET /api/orders

Headers:
Authorization: Bearer BUYER_TOKEN_HERE

✅ Expected: 200 OK with array of orders
```

#### Step 18: Create Transaction
```
POST /api/transactions

Headers:
Authorization: Bearer BUYER_TOKEN_HERE

Body:
{
  "order": "ORDER_ID_FROM_STEP_16",
  "amount": 50000,
  "paymentMethod": "bank_transfer",
  "paymentReference": "TRX123456789"
}

✅ Expected: 201 Created
📝 Note: Save the transaction ID
```

#### Step 19: List Transactions
```
GET /api/transactions

Headers:
Authorization: Bearer BUYER_TOKEN_HERE

✅ Expected: 200 OK with array of transactions
```

---

### Phase 4: Admin Operations (10 minutes)

#### Step 20: Register as Admin
```
POST /api/auth/register

Body:
{
  "name": "Test Admin",
  "email": "admin@test.com",
  "password": "AdminPass123!"
}

✅ Expected: 201 Created
```

#### Step 21: Verify & Login Admin
```
1. Verify email with code
2. Login to get admin token
3. Complete account with role: "admin"

📝 Note: Save admin token
```

#### Step 22: Approve Transaction
```
PATCH /api/transactions/TRANSACTION_ID_FROM_STEP_18

Headers:
Authorization: Bearer ADMIN_TOKEN_HERE

Body:
{
  "status": "approved"
}

✅ Expected: 200 OK
📝 Note: This should trigger a notification to the buyer
```

#### Step 23: Check Buyer Notifications
```
GET /api/notifications

Headers:
Authorization: Bearer BUYER_TOKEN_HERE

✅ Expected: 200 OK with notifications array
📝 Look for: "transaction_approved" notification
```

#### Step 24: Get Admin Dashboard
```
GET /api/admin/dashboard

Headers:
Authorization: Bearer ADMIN_TOKEN_HERE

✅ Expected: 200 OK with stats
```

---

### Phase 5: Additional Features (Optional)

#### Wishlist
```
POST /api/wishlist
Headers: Authorization: Bearer BUYER_TOKEN_HERE
Body: { "product": "PRODUCT_ID" }
```

#### Bids
```
POST /api/bids
Headers: Authorization: Bearer BUYER_TOKEN_HERE
Body: {
  "product": "PRODUCT_ID",
  "proposedPrice": 4500,
  "quantity": 20
}
```

#### Reviews
```
POST /api/reviews
Headers: Authorization: Bearer BUYER_TOKEN_HERE
Body: {
  "agent": "AGENT_USER_ID",
  "rating": 5,
  "comment": "Excellent service!"
}
```

#### Shipping (Transporter)
```
1. Register as transporter
2. Create truck: POST /api/trucks
3. Create driver: POST /api/drivers
4. Assign truck to driver: POST /api/drivers/assign-truck
```

---

## 🧪 Testing Checklist

### Authentication ✅
- [ ] Register user
- [ ] Verify email
- [ ] Login
- [ ] Complete account
- [ ] Get profile
- [ ] Change password
- [ ] Forgot password flow

### Products ✅
- [ ] Create product (agent)
- [ ] List products
- [ ] Get single product
- [ ] Update product
- [ ] Delete product
- [ ] Test buyer cannot create product (403)

### Orders ✅
- [ ] Create order (buyer)
- [ ] List orders
- [ ] Get order details
- [ ] Update order status

### Transactions ✅
- [ ] Create transaction
- [ ] List transactions
- [ ] Approve transaction (admin)
- [ ] Test buyer cannot approve (403)

### Notifications ✅
- [ ] Get notifications
- [ ] Mark as read
- [ ] Delete notification

### Authorization ✅
- [ ] Test protected routes without token (401)
- [ ] Test role-based access (403)
- [ ] Test expired token

---

## 🐛 Common Issues & Solutions

### Issue: "Authentication required"
**Solution:** Make sure you're including the Authorization header:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Issue: "Forbidden" (403)
**Solution:** Check if your user role has permission for this action
- Products: Only agents/admins can create
- Transactions: Only admins can approve
- Farmers: Only agents/admins can create

### Issue: "Email not verified"
**Solution:** Complete the email verification step before login

### Issue: Token expired
**Solution:** Login again to get a new token

### Issue: "Product not found"
**Solution:** Make sure you're using the correct product ID from the create response

---

## 📊 Expected Test Results

After completing all phases, you should have:
- ✅ 3 users (agent, buyer, admin)
- ✅ 1 farmer
- ✅ 1 product
- ✅ 1 order
- ✅ 1 transaction (approved)
- ✅ 1+ notifications

---

## 🔍 Verification Commands

### Check Database
```bash
# Connect to MongoDB
mongosh "YOUR_MONGODB_URI"

# Check users
db.users.find().pretty()

# Check products
db.products.find().pretty()

# Check orders
db.orders.find().pretty()

# Check transactions
db.transactions.find().pretty()

# Check notifications
db.notifications.find().pretty()
```

### Run Automated Tests
```bash
npm test
```

---

## 📝 Notes

- All timestamps are in ISO 8601 format
- Prices are in Naira (₦)
- Phone numbers should include country code (+234)
- Tokens expire after 7 days
- Verification codes expire after 24 hours

---

## 🎉 Success Criteria

You've successfully tested the API if:
1. ✅ All authentication flows work
2. ✅ Products can be created and managed
3. ✅ Orders can be placed and tracked
4. ✅ Transactions can be approved
5. ✅ Notifications are generated
6. ✅ Role-based access control works
7. ✅ All automated tests pass

---

**Happy Testing! 🚀**

For issues or questions, check the main API documentation in `docs/api.md`

## Additional PDF-aligned Endpoints

### Admin User Status
```
PATCH /api/admin/users/:id/status
Body: { "status": "active" | "suspended" }
```

### Admin Transaction Refund by ID
```
POST /api/admin/transactions/:id/refund
Body: { "reason": "...", "refundAmount": 1000 }
```

### Transporter Marketplace
```
GET /api/transporters
GET /api/transporters/:id
GET /api/transporters/:id/reviews
GET /api/transporters/trucks?status=all|empty|almost_full&fromState=&toState=
POST /api/transporters  // transporter/admin create/update profile
```

### Review Interactions
```
POST /api/reviews/:id/reply  // agent reply
POST /api/reviews/:id/like   // buyer like
```

### Transporter Transaction Status
```
PATCH /api/transporters/transactions/:id/status
Body: { "status": "approved" | "pending" }
```

### Customer Support Chat
```
POST /api/customers/:id/chat
Body: { "initialMessage": "Hello" }
```
