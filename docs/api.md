# Tractive API - Complete Manual Testing Guide

## 📋 Table of Contents
1. [Getting Started](#getting-started)
2. [Authentication Flow](#authentication-flow)
3. [User Management](#user-management)
4. [Products & Farmers](#products--farmers)
5. [Orders & Transactions](#orders--transactions)
6. [Shipping & Logistics](#shipping--logistics)
7. [Notifications](#notifications)
8. [Admin Operations](#admin-operations)
9. [Testing Tools](#testing-tools)
10. [Compatibility Endpoints](#compatibility-endpoints)

---

## 🚀 Getting Started

### Base URL
```
Local: http://localhost:3000
Production: https://your-domain.com
```

### Required Headers
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>  // For protected routes
```

### Testing Tools
- **Postman** (Recommended)
- **Thunder Client** (VS Code Extension)
- **cURL** (Command Line)
- **REST Client** (VS Code Extension)

---

## 🔐 Authentication Flow

### Step 1: Register New User

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123!"
}
```

**Expected Response (201):**
```json
{
  "message": "User registered successfully. Please check your email for verification code.",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "buyer",
    "isVerified": false
  }
}
```

**Notes:**
- Password must be at least 8 characters
- Email must be unique
- Verification code sent to email (check console in development)
- Default role is "buyer"

---

### Step 2: Verify Email

**Endpoint:** `POST /api/auth/verify-code`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "code": "123456"
}
```

**Expected Response (200):**
```json
{
  "ok": true,
  "verified": true,
  "message": "Email verified successfully"
}
```

**Notes:**
- Verification code expires after 24 hours
- Check email or server console for the code
- Code is 6 digits

---

### Step 3: Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!"
}
```

**Expected Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "buyer",
    "isVerified": true
  }
}
```

**Notes:**
- Save the token for subsequent requests
- Token expires after 7 days
- Email must be verified before login

---

### Step 4: Complete Account Setup

**Endpoint:** `POST /api/auth/add-account`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Request Body (Agent):**
```json
{
  "role": "agent",
  "businessName": "Doe Farms Ltd",
  "villageOrLocalMarket": "Sabon Gari Market",
  "phone": "+2348012345678",
  "nin": "12345678901",
  "address": "123 Farm Road, Kaduna",
  "country": "Nigeria",
  "state": "Kaduna",
  "interests": ["Grains", "Livestock", "Vegetables"]
}
```

**Request Body (Transporter):**
```json
{
  "role": "transporter",
  "businessName": "Swift Transport Co",
  "phone": "+2348098765432",
  "address": "45 Transport Avenue, Lagos",
  "country": "Nigeria",
  "state": "Lagos",
  "interests": ["Grains", "Tubers"]
}
```

**Request Body (Buyer):**
```json
{
  "role": "buyer",
  "phone": "+2348011223344",
  "address": "78 Market Street, Abuja",
  "country": "Nigeria",
  "state": "Abuja",
  "interests": ["Fish", "Vegetables", "Fruits"]
}
```

**Expected Response (200):**
```json
{
  "message": "Account information updated successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "agent",
    "businessName": "Doe Farms Ltd",
    "phone": "+2348012345678"
  }
}
```

---

### Additional Auth Endpoints

#### Get User Profile
**Endpoint:** `GET /api/profile`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Expected Response (200):**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "role": "agent",
    "businessName": "Doe Farms Ltd",
    "phone": "+2348012345678",
    "isVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

#### Change Password
**Endpoint:** `POST /api/auth/change-password`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Request Body:**
```json
{
  "currentPassword": "SecurePass123!",
  "newPassword": "NewSecurePass456!"
}
```

---

#### Forgot Password
**Endpoint:** `POST /api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "john.doe@example.com"
}
```

**Expected Response (200):**
```json
{
  "message": "If your email exists, you will receive a reset code."
}
```

**Notes:**
- A 6-digit code will be sent to the email
- Code expires in 1 hour
- Check email or server console for the code

---

#### Reset Password
**Endpoint:** `POST /api/auth/reset-password`

**Request Body:**
```json
{
  "token": "abc123xyz...",
  "password": "NewSecurePass456!",
  "confirmPassword": "NewSecurePass456!"
}
```

**Expected Response (200):**
```json
{
  "message": "Password reset successful. You can now login with your new password.",
  "success": true
}
```

**Error Responses:**
```json
// Passwords don't match
{
  "error": "Passwords do not match"
}

// Password too short
{
  "error": "Password must be at least 8 characters long"
}

// Invalid or expired token
{
  "error": "Invalid or expired reset token. Please request a new password reset."
}
```

**Notes:**
- Token comes from the reset link in email
- Password and confirmPassword must match
- Password must be at least 8 characters
- Token expires after 1 hour
- Token is deleted after successful reset (one-time use)

---

## 👥 User Management

### Resend Verification Code
**Endpoint:** `POST /api/auth/resend-verification`

**Request Body:**
```json
{
  "email": "john.doe@example.com"
}
```

---

## 🌾 Products & Farmers

### Create Farmer (Agent/Admin Only)

**Endpoint:** `POST /api/farmers`

**Headers:**
```
Authorization: Bearer <AGENT_OR_ADMIN_TOKEN>
```

**Request Body:**
```json
{
  "name": "Farmer John",
  "phone": "+2348055555555",
  "address": "Farm Village, Kaduna",
  "country": "Nigeria",
  "state": "Kaduna",
  "farmSize": "5 hectares",
  "crops": ["Maize", "Rice", "Beans"]
}
```

**Expected Response (201):**
```json
{
  "message": "Farmer created successfully",
  "farmer": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Farmer John",
    "phone": "+2348055555555",
    "createdBy": "507f1f77bcf86cd799439011",
    "approvalStatus": "pending"
  }
}
```

---

### List Farmers

**Endpoint:** `GET /api/farmers`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Query Parameters:**
```
?page=1&limit=20&status=approved
```

**Expected Response (200):**
```json
{
  "farmers": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Farmer John",
      "phone": "+2348055555555",
      "approvalStatus": "approved",
      "createdBy": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Farmer by ID

**Endpoint:** `GET /api/farmers/:id`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Example:** `GET /api/farmers/507f1f77bcf86cd799439012`

---

### Update Farmer

**Endpoint:** `PATCH /api/farmers/:id`

**Headers:**
```
Authorization: Bearer <AGENT_TOKEN>
```

**Request Body:**
```json
{
  "phone": "+2348055555556",
  "farmSize": "10 hectares"
}
```

---

### Create Product (Agent/Admin Only)

**Endpoint:** `POST /api/products`

**Headers:**
```
Authorization: Bearer <AGENT_OR_ADMIN_TOKEN>
```

**Request Body:**
```json
{
  "name": "Fresh Maize",
  "description": "High quality yellow maize from Kaduna farms",
  "price": 5000,
  "quantity": 100,
  "unit": "kg",
  "categories": ["Grains"],
  "images": [
    "https://example.com/maize1.jpg",
    "https://example.com/maize2.jpg"
  ],
  "videos": [],
  "farmer": "507f1f77bcf86cd799439012"
}
```

**Expected Response (201):**
```json
{
  "message": "Product created successfully",
  "product": {
    "_id": "507f1f77bcf86cd799439013",
    "name": "Fresh Maize",
    "price": 5000,
    "quantity": 100,
    "owner": "507f1f77bcf86cd799439011",
    "farmer": "507f1f77bcf86cd799439012",
    "status": "available"
  }
}
```

---

### List Products

**Endpoint:** `GET /api/products`

**Query Parameters:**
```
?page=1&limit=20&category=Grains&minPrice=1000&maxPrice=10000&search=maize
```

**Expected Response (200):**
```json
{
  "products": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Fresh Maize",
      "description": "High quality yellow maize",
      "price": 5000,
      "quantity": 100,
      "images": ["https://example.com/maize1.jpg"],
      "owner": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "businessName": "Doe Farms Ltd"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Product by ID

**Endpoint:** `GET /api/products/:id`

**Example:** `GET /api/products/507f1f77bcf86cd799439013`

---

### Update Product

**Endpoint:** `PATCH /api/products/:id`

**Headers:**
```
Authorization: Bearer <AGENT_TOKEN>
```

**Request Body:**
```json
{
  "price": 5500,
  "quantity": 150
}
```

---

### Delete Product

**Endpoint:** `DELETE /api/products/:id`

**Headers:**
```
Authorization: Bearer <AGENT_TOKEN>
```

---

## 🛒 Orders & Transactions

### Create Order (Buyer)

**Endpoint:** `POST /api/orders`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Request Body:**
```json
{
  "products": [
    {
      "product": "507f1f77bcf86cd799439013",
      "quantity": 10
    }
  ],
  "totalAmount": 50000,
  "address": "123 Delivery Street, Abuja",
  "phone": "+2348011223344",
  "notes": "Please deliver in the morning"
}
```

**Expected Response (201):**
```json
{
  "message": "Order created successfully",
  "order": {
    "_id": "507f1f77bcf86cd799439014",
    "buyer": "507f1f77bcf86cd799439011",
    "products": [
      {
        "product": "507f1f77bcf86cd799439013",
        "quantity": 10,
        "price": 5000
      }
    ],
    "totalAmount": 50000,
    "status": "pending",
    "transportStatus": "pending"
  }
}
```

---

### List Orders

**Endpoint:** `GET /api/orders`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Query Parameters:**
```
?page=1&limit=20&status=pending&transportStatus=on_transit
```

---

### Get Order by ID

**Endpoint:** `GET /api/orders/:id`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

---

### Update Order Status

**Endpoint:** `PATCH /api/orders/:id`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Request Body:**
```json
{
  "status": "paid",
  "transportStatus": "on_transit",
  "transporter": "507f1f77bcf86cd799439015"
}
```

---

### Create Transaction

**Endpoint:** `POST /api/transactions`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Request Body:**
```json
{
  "order": "507f1f77bcf86cd799439014",
  "amount": 50000,
  "paymentMethod": "bank_transfer",
  "paymentReference": "TRX123456789"
}
```

**Expected Response (201):**
```json
{
  "message": "Transaction created successfully",
  "transaction": {
    "_id": "507f1f77bcf86cd799439016",
    "order": "507f1f77bcf86cd799439014",
    "buyer": "507f1f77bcf86cd799439011",
    "amount": 50000,
    "status": "pending",
    "paymentMethod": "bank_transfer"
  }
}
```

---

### List Transactions

**Endpoint:** `GET /api/transactions`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Query Parameters:**
```
?page=1&limit=20&status=approved
```

---

### Approve Transaction (Admin Only)

**Endpoint:** `PATCH /api/transactions/:id`

**Headers:**
```
Authorization: Bearer <ADMIN_TOKEN>
```

**Request Body:**
```json
{
  "status": "approved"
}
```

**Expected Response (200):**
```json
{
  "message": "Transaction approved successfully",
  "transaction": {
    "_id": "507f1f77bcf86cd799439016",
    "status": "approved",
    "approvedBy": "507f1f77bcf86cd799439017",
    "approvedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## 🚚 Shipping & Logistics

### Create Truck (Transporter)

**Endpoint:** `POST /api/trucks`

**Headers:**
```
Authorization: Bearer <TRANSPORTER_TOKEN>
```

**Request Body:**
```json
{
  "plateNumber": "ABC123XYZ",
  "model": "MAN Diesel",
  "capacity": "20 tons",
  "route": {
    "fromState": "Kaduna",
    "toState": "Lagos"
  }
}
```

**Expected Response (201):**
```json
{
  "message": "Truck created successfully",
  "truck": {
    "_id": "507f1f77bcf86cd799439018",
    "plateNumber": "ABC123XYZ",
    "model": "MAN Diesel",
    "capacity": "20 tons",
    "owner": "507f1f77bcf86cd799439015",
    "status": "available"
  }
}
```

---

### List Trucks

**Endpoint:** `GET /api/trucks`

**Headers:**
```
Authorization: Bearer <TRANSPORTER_TOKEN>
```

---

### Create Driver (Transporter)

**Endpoint:** `POST /api/drivers`

**Headers:**
```
Authorization: Bearer <TRANSPORTER_TOKEN>
```

**Request Body:**
```json
{
  "name": "Driver John",
  "phone": "+2348077777777",
  "licenseNumber": "DRV123456",
  "licenseExpiry": "2025-12-31"
}
```

**Expected Response (201):**
```json
{
  "message": "Driver created successfully",
  "driver": {
    "_id": "507f1f77bcf86cd799439019",
    "name": "Driver John",
    "phone": "+2348077777777",
    "licenseNumber": "DRV123456",
    "owner": "507f1f77bcf86cd799439015"
  }
}
```

---

### Assign Truck to Driver

**Endpoint:** `POST /api/drivers/assign-truck`

**Headers:**
```
Authorization: Bearer <TRANSPORTER_TOKEN>
```

**Request Body:**
```json
{
  "driverId": "507f1f77bcf86cd799439019",
  "truckId": "507f1f77bcf86cd799439018"
}
```

---

### Create Shipping Request (Buyer)

**Endpoint:** `POST /api/shipping`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Request Body:**
```json
{
  "product": "507f1f77bcf86cd799439013",
  "productName": "Fresh Maize",
  "quantity": 10,
  "pickupLocation": "Kaduna Farm",
  "deliveryLocation": "Lagos Market",
  "pickupDate": "2024-01-15",
  "negotiable": true,
  "proposedPrice": 15000
}
```

**Expected Response (201):**
```json
{
  "message": "Shipping request created successfully",
  "shippingRequest": {
    "_id": "507f1f77bcf86cd799439020",
    "buyer": "507f1f77bcf86cd799439011",
    "product": "507f1f77bcf86cd799439013",
    "status": "pending",
    "negotiable": true
  }
}
```

---

### List Shipping Requests

**Endpoint:** `GET /api/shipping`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Query Parameters:**
```
?page=1&limit=20&status=pending
```

---

### Create Negotiation Offer (Transporter)

**Endpoint:** `POST /api/negotiations`

**Headers:**
```
Authorization: Bearer <TRANSPORTER_TOKEN>
```

**Request Body:**
```json
{
  "shippingRequest": "507f1f77bcf86cd799439020",
  "proposedPrice": 12000,
  "message": "I can deliver within 2 days"
}
```

---

### Accept/Reject Negotiation

**Endpoint:** `PATCH /api/negotiations/:id`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Request Body:**
```json
{
  "status": "accepted"
}
```

---

## 💰 Bids

### Create Bid (Buyer)

**Endpoint:** `POST /api/bids`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Request Body:**
```json
{
  "product": "507f1f77bcf86cd799439013",
  "proposedPrice": 4500,
  "quantity": 20,
  "message": "Interested in bulk purchase"
}
```

**Expected Response (201):**
```json
{
  "message": "Bid created successfully",
  "bid": {
    "_id": "507f1f77bcf86cd799439021",
    "product": "507f1f77bcf86cd799439013",
    "buyer": "507f1f77bcf86cd799439011",
    "proposedPrice": 4500,
    "quantity": 20,
    "status": "pending"
  }
}
```

---

### List Bids

**Endpoint:** `GET /api/bids`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

---

### Accept/Reject Bid (Agent)

**Endpoint:** `PATCH /api/bids/:id`

**Headers:**
```
Authorization: Bearer <AGENT_TOKEN>
```

**Request Body:**
```json
{
  "status": "accepted",
  "counterOffer": 4700
}
```

---

## 🔔 Notifications

### Get Notifications

**Endpoint:** `GET /api/notifications`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Query Parameters:**
```
?page=1&limit=20&isRead=false
```

**Expected Response (200):**
```json
{
  "success": true,
  "notifications": [
    {
      "_id": "507f1f77bcf86cd799439022",
      "user": "507f1f77bcf86cd799439011",
      "type": "order_created",
      "title": "Order Created",
      "message": "Your order has been created successfully",
      "isRead": false,
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  ],
  "unreadCount": 5,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### Mark Notification as Read

**Endpoint:** `PATCH /api/notifications/:id`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Request Body:**
```json
{
  "isRead": true
}
```

---

### Mark All Notifications as Read

**Endpoint:** `PATCH /api/notifications`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Request Body:**
```json
{
  "isRead": true
}
```

---

### Delete Notification

**Endpoint:** `DELETE /api/notifications/:id`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

---

## ❤️ Wishlist

### Add to Wishlist

**Endpoint:** `POST /api/wishlist`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Request Body:**
```json
{
  "product": "507f1f77bcf86cd799439013"
}
```

---

### Get Wishlist

**Endpoint:** `GET /api/wishlist`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

---

### Remove from Wishlist

**Endpoint:** `DELETE /api/wishlist/:productId`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

---

## ⭐ Reviews

### Create Review

**Endpoint:** `POST /api/reviews`

**Headers:**
```
Authorization: Bearer <BUYER_TOKEN>
```

**Request Body:**
```json
{
  "agent": "507f1f77bcf86cd799439011",
  "rating": 5,
  "comment": "Excellent service and quality products!"
}
```

---

### Get Reviews

**Endpoint:** `GET /api/reviews`

**Query Parameters:**
```
?agent=507f1f77bcf86cd799439011&page=1&limit=20
```

---

## 💬 Chat

### Get Conversations

**Endpoint:** `GET /api/chat`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

---

### Get Messages

**Endpoint:** `GET /api/chat/:conversationId`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

---

### Send Message

**Endpoint:** `POST /api/chat/:conversationId`

**Headers:**
```
Authorization: Bearer <YOUR_JWT_TOKEN>
```

**Request Body:**
```json
{
  "message": "Hello, is this product still available?"
}
```

---

## 🛠️ Admin Operations

### Get Dashboard Stats

**Endpoint:** `GET /api/admin/dashboard`

**Headers:**
```
Authorization: Bearer <ADMIN_TOKEN>
```

**Expected Response (200):**
```json
{
  "stats": {
    "totalUsers": 150,
    "totalProducts": 500,
    "totalOrders": 200,
    "totalRevenue": 5000000,
    "pendingApprovals": 10
  }
}
```

---

### List All Users

**Endpoint:** `GET /api/admin/users`

**Headers:**
```
Authorization: Bearer <ADMIN_TOKEN>
```

**Query Parameters:**
```
?page=1&limit=20&role=agent&status=active
```

---

### Approve/Reject Farmer

**Endpoint:** `PATCH /api/admin/approvals/farmers/:id`

**Headers:**
```
Authorization: Bearer <ADMIN_TOKEN>
```

**Request Body:**
```json
{
  "approvalStatus": "approved"
}
```

---

### List Pending Transactions

**Endpoint:** `GET /api/admin/transactions`

**Headers:**
```
Authorization: Bearer <ADMIN_TOKEN>
```

**Query Parameters:**
```
?status=pending&page=1&limit=20
```

---

### Handle Support Queries

**Endpoint:** `GET /api/admin/queries`

**Headers:**
```
Authorization: Bearer <ADMIN_TOKEN>
```

---

### Manage Live Chats

**Endpoint:** `GET /api/admin/live-chats`

**Headers:**
```
Authorization: Bearer <ADMIN_TOKEN>
```

---

## 🧪 Testing Tools & Tips

### Using Postman

1. **Create Environment:**
   - Variable: `base_url` = `http://localhost:3000`
   - Variable: `token` = `<YOUR_JWT_TOKEN>`

2. **Set Authorization:**
   - Type: Bearer Token
   - Token: `{{token}}`

3. **Create Collection:**
   - Organize requests by feature
   - Use pre-request scripts for dynamic data

### Using cURL

**Example: Register User**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Example: Get Products (Authenticated)**
```bash
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Testing Workflow

1. **Register & Verify** → Get JWT token
2. **Complete Account** → Set role and details
3. **Create Resources** → Products, farmers, trucks
4. **Test Transactions** → Orders, payments, shipping
5. **Test Notifications** → Check notification generation
6. **Test Admin** → Approvals, dashboard

---

## 📝 Common Response Codes

- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid request data
- **401 Unauthorized** - Missing or invalid token
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error

---

## 🔍 Error Response Format

```json
{
  "error": "Error message here",
  "details": "Additional error details"
}
```

---

## Compatibility Endpoints

These alias routes are included in the OpenAPI spec and `/api-docs` so the frontend can test against the exact expected paths:

- `DELETE /api/farmers/:id`
- `PATCH /api/admin/approvals/agents/:id`
- `PATCH /api/admin/approvals/farmers/:id`
- `PATCH /api/notifications/:id/read`
- `DELETE /api/help/:id`
- `PATCH /api/chat/:conversationId/messages/:messageId`
- `DELETE /api/chat/:conversationId/messages/:messageId`
- `GET /api/transporters/trucks/almost-full`
- `GET /api/transporters/trucks/empty`
- `GET /api/transporters/trucks/:id`
- `GET /api/transporters/recommendations`
- `GET /api/transporters/reviews`
- `POST /api/admin/users/:id/onboard`
- `GET /api/admin/users/:profession`
- `GET /api/customers`

---

## 📞 Support

For issues or questions:
- Email: support@tractive.com
- Documentation: https://docs.tractive.com
- GitHub: https://github.com/tractive/api

---

**Last Updated:** December 2, 2024
**API Version:** 1.0.0
