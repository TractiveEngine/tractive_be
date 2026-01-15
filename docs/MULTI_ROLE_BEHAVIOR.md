# 👥 Multi-Role User Behavior Guide

## 🎯 Overview

The Tractive system supports **multiple roles per user**. A single user can be a buyer, agent, transporter, and/or admin simultaneously.

---

## 📋 User Role System

### Role Fields in User Model

```typescript
{
  roles: ["buyer", "agent", "transporter", "admin"],  // Array of roles
  activeRole: "agent"  // Currently active role (optional)
}
```

### Example Multi-Role Users

**User 1: Buyer + Agent**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "john@example.com",
  "roles": ["buyer", "agent"],
  "activeRole": "agent"
}
```

**User 2: Agent + Transporter**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "email": "jane@example.com",
  "roles": ["agent", "transporter"],
  "activeRole": "agent"
}
```

**User 3: All Roles (Super User)**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "email": "admin@example.com",
  "roles": ["buyer", "agent", "transporter", "admin"],
  "activeRole": "admin"
}
```

---

## 🔐 Product Creation Behavior

### Authorization Logic

```typescript
// Current implementation
if (!user.roles.some((r: string) => ["admin", "agent"].includes(r))) {
  return 403 Forbidden
}
```

**Translation:** User can create products if they have **ANY** of these roles:
- admin
- agent

### Multi-Role Scenarios

| User Roles | Can Create Products? | Reason |
|------------|---------------------|---------|
| `["buyer"]` | ❌ No | No admin or agent role |
| `["agent"]` | ✅ Yes | Has agent role |
| `["admin"]` | ✅ Yes | Has admin role |
| `["buyer", "agent"]` | ✅ Yes | Has agent role |
| `["buyer", "transporter"]` | ❌ No | No admin or agent role |
| `["agent", "transporter"]` | ✅ Yes | Has agent role |
| `["buyer", "agent", "transporter"]` | ✅ Yes | Has agent role |
| `["buyer", "agent", "transporter", "admin"]` | ✅ Yes | Has both admin and agent |

### Key Point

**The `activeRole` field doesn't matter for authorization!**

Authorization checks the `roles` array, not `activeRole`. So even if a user's `activeRole` is "buyer", they can still create products if they have "agent" in their `roles` array.

---

## 📝 JSON Format: Create Product with Farmer

### Complete Request Example

```json
POST /api/products

Headers:
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

Body:
{
  "name": "Fresh Yellow Maize",
  "description": "Premium quality yellow maize harvested from Kaduna farms. Organic and pesticide-free.",
  "price": 5000,
  "quantity": 100,
  "unit": "kg",
  "categories": ["Grains", "Cereals"],
  "farmer": "507f1f77bcf86cd799439012",
  "images": [
    "https://example.com/maize1.jpg",
    "https://example.com/maize2.jpg"
  ],
  "videos": [
    "https://example.com/maize-video.mp4"
  ]
}
```

### Field Descriptions

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `name` | String | ✅ Yes | Product name | "Fresh Yellow Maize" |
| `description` | String | ❌ No | Detailed description | "Premium quality..." |
| `price` | Number | ✅ Yes | Price in Naira | 5000 |
| `quantity` | Number | ❌ No | Available quantity | 100 |
| `unit` | String | ❌ No | Unit of measurement | "kg", "bag", "ton" |
| `categories` | Array | ❌ No | Product categories | ["Grains", "Cereals"] |
| `farmer` | String | ❌ No | Farmer ObjectId | "507f1f77bcf86cd799439012" |
| `images` | Array | ❌ No | Image URLs | ["url1", "url2"] |
| `videos` | Array | ❌ No | Video URLs | ["url1"] |

### Minimal Request (Only Required Fields)

```json
{
  "name": "Fresh Maize",
  "price": 5000
}
```

### Request with Farmer

```json
{
  "name": "Fresh Yellow Maize",
  "description": "High quality maize from Kaduna",
  "price": 5000,
  "quantity": 100,
  "unit": "kg",
  "categories": ["Grains"],
  "farmer": "507f1f77bcf86cd799439012",
  "images": ["https://example.com/maize.jpg"]
}
```

### Request without Farmer (Also Valid)

```json
{
  "name": "Fresh Yellow Maize",
  "description": "High quality maize",
  "price": 5000,
  "quantity": 100,
  "unit": "kg",
  "categories": ["Grains"],
  "images": ["https://example.com/maize.jpg"]
}
```

---

## 🧪 Testing Multi-Role Scenarios

### Scenario 1: User with Buyer + Agent Roles

**Setup:**
```json
// User has both roles
{
  "roles": ["buyer", "agent"],
  "activeRole": "buyer"  // Currently acting as buyer
}
```

**Test: Create Product**
```json
POST /api/products
Authorization: Bearer USER_TOKEN

{
  "name": "Maize",
  "price": 5000,
  "farmer": "FARMER_ID"
}

✅ Expected: 201 Created
Reason: User has "agent" in roles array
```

**Test: Create Order (as Buyer)**
```json
POST /api/orders
Authorization: Bearer USER_TOKEN

{
  "products": [{"product": "PRODUCT_ID", "quantity": 10}],
  "totalAmount": 50000
}

✅ Expected: 201 Created
Reason: User has "buyer" in roles array
```

---

### Scenario 2: User with Only Buyer Role

**Setup:**
```json
{
  "roles": ["buyer"],
  "activeRole": "buyer"
}
```

**Test: Create Product**
```json
POST /api/products
Authorization: Bearer USER_TOKEN

{
  "name": "Maize",
  "price": 5000
}

❌ Expected: 403 Forbidden
{
  "error": "Only admin or agent can create products"
}
```

---

### Scenario 3: User with Agent + Transporter Roles

**Setup:**
```json
{
  "roles": ["agent", "transporter"],
  "activeRole": "transporter"
}
```

**Test: Create Product**
```json
POST /api/products
Authorization: Bearer USER_TOKEN

{
  "name": "Maize",
  "price": 5000,
  "farmer": "FARMER_ID"
}

✅ Expected: 201 Created
Reason: User has "agent" in roles array (activeRole doesn't matter)
```

**Test: Create Truck (as Transporter)**
```json
POST /api/trucks
Authorization: Bearer USER_TOKEN

{
  "plateNumber": "ABC123",
  "model": "MAN Diesel",
  "capacity": "20 tons"
}

✅ Expected: 201 Created
Reason: User has "transporter" in roles array
```

---

## 🎯 Best Practices

### 1. Role Assignment

**When to assign multiple roles:**
- ✅ User runs a farm AND sells products → `["agent", "buyer"]`
- ✅ User transports AND sells products → `["agent", "transporter"]`
- ✅ Admin who also buys → `["admin", "buyer"]`

**When NOT to assign multiple roles:**
- ❌ Regular buyer who only purchases → `["buyer"]` only
- ❌ Driver who only transports → `["transporter"]` only

### 2. Active Role Usage

The `activeRole` field can be used for:
- UI customization (show agent dashboard vs buyer dashboard)
- Analytics (track which role user is currently using)
- Logging (record actions by role)

**But NOT for:**
- ❌ Authorization (always check `roles` array)
- ❌ Access control (use `roles` array instead)

### 3. Frontend Implementation

```typescript
// Check if user can create products
function canCreateProducts(user) {
  return user.roles.some(role => ['admin', 'agent'].includes(role));
}

// Check if user can create orders
function canCreateOrders(user) {
  return user.roles.includes('buyer');
}

// Check if user can manage trucks
function canManageTrucks(user) {
  return user.roles.some(role => ['admin', 'transporter'].includes(role));
}
```

---

## 📊 Complete Example: Multi-Role User Journey

### User Profile
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "john@example.com",
  "name": "John Doe",
  "roles": ["buyer", "agent"],
  "activeRole": "agent",
  "businessName": "Doe Farms Ltd"
}
```

### Step 1: Create Farmer (as Agent)
```json
POST /api/farmers
Authorization: Bearer JOHN_TOKEN

{
  "name": "Farmer Mike",
  "phone": "+2348055555555",
  "address": "Farm Village, Kaduna"
}

✅ Success: Farmer created
```

### Step 2: Create Product (as Agent)
```json
POST /api/products
Authorization: Bearer JOHN_TOKEN

{
  "name": "Fresh Maize",
  "price": 5000,
  "quantity": 100,
  "farmer": "FARMER_MIKE_ID",
  "categories": ["Grains"]
}

✅ Success: Product created
```

### Step 3: Switch to Buyer Mode (Frontend Only)
```json
// Update activeRole (optional, for UI purposes)
PATCH /api/profile
{
  "activeRole": "buyer"
}
```

### Step 4: Create Order (as Buyer)
```json
POST /api/orders
Authorization: Bearer JOHN_TOKEN

{
  "products": [
    {"product": "ANOTHER_PRODUCT_ID", "quantity": 10}
  ],
  "totalAmount": 50000
}

✅ Success: Order created
```

---

## ✅ Summary

### Multi-Role Behavior
- ✅ Users can have multiple roles simultaneously
- ✅ Authorization checks the `roles` array
- ✅ `activeRole` is for UI/UX, not authorization
- ✅ If user has agent role, they can create products (regardless of activeRole)

### Product Creation with Farmer
```json
{
  "name": "Product Name",           // Required
  "price": 5000,                    // Required
  "description": "Description",     // Optional
  "quantity": 100,                  // Optional
  "unit": "kg",                     // Optional
  "categories": ["Grains"],         // Optional
  "farmer": "FARMER_ID",            // Optional
  "images": ["url"],                // Optional
  "videos": ["url"]                 // Optional
}
```

### Authorization
- ✅ Admin or Agent → Can create products
- ❌ Buyer only → Cannot create products
- ✅ Buyer + Agent → Can create products (has agent role)

---

**Last Updated:** December 2, 2024
