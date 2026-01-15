# ✅ Product Creation - Security & Features Update

## 🔒 Security Check Results

### Authorization ✅
**Only admin and agent can create products**

```typescript
// Authorization check in POST /api/products
if (!user || !user.roles.some((r: string) => ["admin", "agent"].includes(r))) {
  return NextResponse.json(
    { error: "Only admin or agent can create products" },
    { status: 403 }
  );
}
```

**Roles that CAN create products:**
- ✅ Admin
- ✅ Agent

**Roles that CANNOT create products:**
- ❌ Buyer (403 Forbidden)
- ❌ Transporter (403 Forbidden)
- ❌ Unauthenticated users (401 Unauthorized)

---

## 🌾 Farmer Attachment Feature

### What Was Added

**1. Product Model Updated**
```typescript
// Added fields:
farmer: { type: mongoose.Schema.Types.ObjectId, ref: "Farmer" }
unit: { type: String, default: "kg" }
status: { type: String, enum: ["available", "out_of_stock", "discontinued"], default: "available" }
```

**2. Product Creation Endpoint Updated**
```typescript
// Now accepts:
{
  "name": "Fresh Maize",
  "description": "High quality yellow maize",
  "price": 5000,
  "quantity": 100,
  "unit": "kg",              // NEW
  "categories": ["Grains"],
  "farmer": "FARMER_ID",     // NEW - Optional
  "images": ["url1", "url2"],
  "videos": []
}
```

**3. Farmer Validation**
- If farmer ID is provided, system validates it exists
- If invalid farmer ID → Returns 400 error
- If no farmer ID → Product created without farmer (optional field)

---

## 📋 Complete Product Creation Flow

### Step 1: Create Farmer (Agent/Admin)
```json
POST /api/farmers

Headers:
Authorization: Bearer AGENT_TOKEN

Body:
{
  "name": "Farmer John",
  "phone": "+2348055555555",
  "address": "Farm Village, Kaduna",
  "country": "Nigeria",
  "state": "Kaduna",
  "farmSize": "5 hectares",
  "crops": ["Maize", "Rice"]
}

Response:
{
  "message": "Farmer created successfully",
  "farmer": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Farmer John",
    ...
  }
}
```

### Step 2: Create Product with Farmer (Agent/Admin)
```json
POST /api/products

Headers:
Authorization: Bearer AGENT_TOKEN

Body:
{
  "name": "Fresh Yellow Maize",
  "description": "High quality yellow maize from Kaduna farms",
  "price": 5000,
  "quantity": 100,
  "unit": "kg",
  "categories": ["Grains"],
  "farmer": "507f1f77bcf86cd799439012",  // Farmer ID from Step 1
  "images": ["https://example.com/maize.jpg"]
}

Response:
{
  "message": "Product created successfully",
  "product": {
    "_id": "507f1f77bcf86cd799439013",
    "name": "Fresh Yellow Maize",
    "price": 5000,
    "quantity": 100,
    "unit": "kg",
    "owner": "AGENT_USER_ID",
    "farmer": "507f1f77bcf86cd799439012",  // Linked!
    "status": "available",
    ...
  }
}
```

### Step 3: Verify Buyer Cannot Create (Security Test)
```json
POST /api/products

Headers:
Authorization: Bearer BUYER_TOKEN

Body:
{
  "name": "Test Product",
  "price": 1000
}

Response: 403 Forbidden
{
  "error": "Only admin or agent can create products"
}
```

---

## 🧪 Testing Checklist

### Authorization Tests

**Test 1: Agent Can Create ✅**
```bash
POST /api/products
Authorization: Bearer AGENT_TOKEN
Body: { "name": "Product", "price": 5000 }
Expected: 201 Created
```

**Test 2: Admin Can Create ✅**
```bash
POST /api/products
Authorization: Bearer ADMIN_TOKEN
Body: { "name": "Product", "price": 5000 }
Expected: 201 Created
```

**Test 3: Buyer Cannot Create ❌**
```bash
POST /api/products
Authorization: Bearer BUYER_TOKEN
Body: { "name": "Product", "price": 5000 }
Expected: 403 Forbidden
```

**Test 4: Transporter Cannot Create ❌**
```bash
POST /api/products
Authorization: Bearer TRANSPORTER_TOKEN
Body: { "name": "Product", "price": 5000 }
Expected: 403 Forbidden
```

**Test 5: Unauthenticated Cannot Create ❌**
```bash
POST /api/products
No Authorization Header
Body: { "name": "Product", "price": 5000 }
Expected: 401 Unauthorized
```

### Farmer Attachment Tests

**Test 6: Product with Valid Farmer ✅**
```bash
POST /api/products
Authorization: Bearer AGENT_TOKEN
Body: {
  "name": "Maize",
  "price": 5000,
  "farmer": "VALID_FARMER_ID"
}
Expected: 201 Created with farmer linked
```

**Test 7: Product without Farmer ✅**
```bash
POST /api/products
Authorization: Bearer AGENT_TOKEN
Body: {
  "name": "Maize",
  "price": 5000
}
Expected: 201 Created (farmer is optional)
```

**Test 8: Product with Invalid Farmer ❌**
```bash
POST /api/products
Authorization: Bearer AGENT_TOKEN
Body: {
  "name": "Maize",
  "price": 5000,
  "farmer": "INVALID_FARMER_ID"
}
Expected: 400 Bad Request - "Invalid farmer ID"
```

---

## 📊 Product Model Schema

```typescript
{
  name: String (required)
  description: String
  price: Number (required)
  quantity: Number (default: 0)
  unit: String (default: "kg")
  owner: ObjectId → User (required)
  farmer: ObjectId → Farmer (optional)
  images: [String]
  videos: [String]
  status: String (enum: ["available", "out_of_stock", "discontinued"])
  categories: [String]
  createdAt: Date
  updatedAt: Date
}
```

---

## 🔐 Security Features

1. **Role-Based Access Control (RBAC)**
   - Only admin and agent can create products
   - Buyers and transporters get 403 Forbidden
   - Unauthenticated users get 401 Unauthorized

2. **Farmer Validation**
   - Validates farmer ID exists before linking
   - Prevents orphaned references
   - Returns clear error messages

3. **JWT Authentication**
   - All product creation requires valid JWT token
   - Token verified before processing request
   - User role checked from database

4. **Input Validation**
   - Name and price are required
   - Quantity defaults to 0 if not provided
   - Unit defaults to "kg" if not provided
   - Arrays default to empty if not provided

---

## 🎯 Summary

### ✅ What's Working

1. **Authorization** - Only admin/agent can create products
2. **Farmer Linking** - Products can be linked to farmers
3. **Validation** - Farmer IDs are validated before linking
4. **Optional Fields** - Farmer is optional, not required
5. **Security** - Proper role-based access control

### 🆕 What's New

1. **Farmer field** - Products can now be linked to farmers
2. **Unit field** - Specify product unit (kg, bag, ton, etc.)
3. **Status field** - Track product availability
4. **Better validation** - Validates farmer exists before linking
5. **Better response** - Returns success message with product

---

## 📝 Example: Complete Product Creation

```json
POST /api/products

Headers:
Authorization: Bearer AGENT_TOKEN

Body:
{
  "name": "Fresh Yellow Maize",
  "description": "Premium quality maize from Kaduna",
  "price": 5000,
  "quantity": 100,
  "unit": "kg",
  "categories": ["Grains", "Cereals"],
  "farmer": "507f1f77bcf86cd799439012",
  "images": [
    "https://example.com/maize1.jpg",
    "https://example.com/maize2.jpg"
  ],
  "videos": []
}

Response: 201 Created
{
  "message": "Product created successfully",
  "product": {
    "_id": "507f1f77bcf86cd799439013",
    "name": "Fresh Yellow Maize",
    "description": "Premium quality maize from Kaduna",
    "price": 5000,
    "quantity": 100,
    "unit": "kg",
    "owner": "507f1f77bcf86cd799439011",
    "farmer": "507f1f77bcf86cd799439012",
    "images": ["https://example.com/maize1.jpg", "https://example.com/maize2.jpg"],
    "videos": [],
    "status": "available",
    "categories": ["Grains", "Cereals"],
    "createdAt": "2024-12-02T18:00:00.000Z",
    "updatedAt": "2024-12-02T18:00:00.000Z"
  }
}
```

---

**Last Updated:** December 2, 2024
**Status:** ✅ All security checks passed, farmer attachment implemented
