# Tractive API Documentation

## Authentication

- **POST /api/auth/register** — Register a user
- **POST /api/auth/login** — Login and get JWT token
- **POST /api/auth/verify-code** — Verify email with code

## Products

- **POST /api/products** — Create product (admin/agent only)
- **GET /api/products** — List products
- **GET /api/products/{id}** — Get product by ID
- **PATCH /api/products/{id}** — Update product (admin/agent only)

## Farmers

- **POST /api/farmers** — Create farmer (agent/admin only)
- **GET /api/farmers** — List farmers created by you
- **GET /api/farmers/{id}** — Get farmer by ID
- **PATCH /api/farmers/{id}** — Update farmer (agent only)

## Orders

- **POST /api/orders** — Create order
- **GET /api/orders** — List your orders
- **GET /api/orders/{id}** — Get order by ID
- **PATCH /api/orders/{id}** — Update order status/transport

## Transactions

- **POST /api/transactions** — Create transaction for paid order
- **GET /api/transactions** — List your transactions
- **GET /api/transactions/{id}** — Get transaction by ID
- **PATCH /api/transactions/{id}** — Approve transaction (admin only)

## API Usage Guide

### 1. Register New User

**Endpoint:**  
POST `/api/auth/register`

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "yourpassword"
}
```

**Response:**  
- Success: Verification code sent to email.

---

### 2. Verify Email

**Endpoint:**  
POST `/api/auth/verify-code`

**Body:**
```json
{
  "email": "john@example.com",
  "code": "123456"
}
```

**Response:**  
- Success: Email verified.

---

### 3. Login

**Endpoint:**  
POST `/api/auth/login`

**Body:**
```json
{
  "email": "john@example.com",
  "password": "yourpassword"
}
```

**Response:**  
- Success: `{ "token": "<JWT token>" }`

---

### 4. Forgot Password

**Endpoint:**  
POST `/api/auth/forgot-password`

**Body:**
```json
{
  "email": "john@example.com"
}
```

**Response:**  
- Success: Password reset link sent to email.

---

### 5. Reset Password

**Endpoint:**  
POST `/api/auth/reset-password`

**Body:**
```json
{
  "token": "<reset-token-from-email>",
  "password": "newpassword"
}
```

**Response:**  
- Success: Password reset successful.

---

### 6. Add Account Type / Extra Info

**Endpoint:**  
POST `/api/auth/add-account`

**Headers:**  
`Authorization: Bearer <JWT token>`

**Body:**
```json
{
  "role": "agent",
  "businessName": "Doe Farms",
  "villageOrLocalMarket": "Sabon Gari",
  "phone": "08012345678",
  "nin": "12345678901",
  "interests": ["Grains", "Livestock"]
}
```

**Response:**  
- Success: Account type and info updated.

---

### 7. Example: Create Product

**Endpoint:**  
POST `/api/products`

**Headers:**  
`Authorization: Bearer <JWT token>`

**Body:**
```json
{
  "name": "Maize",
  "description": "Fresh maize",
  "price": 1000,
  "quantity": 50,
  "images": ["https://example.com/image.jpg"],
  "videos": [],
  "categories": ["Grains"]
}
```

---

### 8. Example: Onboard Driver

**Endpoint:**  
POST `/api/drivers`

**Headers:**  
`Authorization: Bearer <JWT token>`

**Body:**
```json
{
  "name": "Driver One",
  "phone": "08011223344",
  "licenseNumber": "DRV123456"
}
```

---

### 9. Example: Onboard Truck

**Endpoint:**  
POST `/api/trucks`

**Headers:**  
`Authorization: Bearer <JWT token>`

**Body:**
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

---

### 10. Example: Assign Truck to Driver

**Endpoint:**  
POST `/api/drivers/assign-truck`

**Headers:**  
`Authorization: Bearer <JWT token>`

**Body:**
```json
{
  "driverId": "<driver-object-id>",
  "truckId": "<truck-object-id>"
}
```

---

## Auth Header

All protected endpoints require:
```
Authorization: Bearer <JWT token>
```

---

# Tractive API Usage Guide

## Next Steps After Email Verification

---

### 1. Login

**POST /api/auth/login**

```json
{
  "email": "caspar.georgiy@freedrops.org",
  "password": "Password123!"
}
```
_Response:_ `{ "token": "<JWT token>" }`

---

### 2. Complete Registration (Add Account Info)

**POST /api/auth/add-account**

Headers:
```
Authorization: Bearer <JWT token>
```

**Body Example (Agent):**
```json
{
  "role": "agent",
  "businessName": "Agbe Buyer Farms",
  "villageOrLocalMarket": "Sabon Gari",
  "phone": "08012345678",
  "nin": "12345678901",
  "interests": ["Grains", "Livestock"]
}
```

**Body Example (Transporter):**
```json
{
  "role": "transporter",
  "businessName": "Agbe Transport",
  "phone": "08098765432",
  "interests": ["Tubers", "Livestock"]
}
```

**Body Example (Buyer):**
```json
{
  "role": "buyer",
  "phone": "08011223344",
  "interests": ["Fish", "Vegetable"]
}
```

_Response:_ Account type and info updated.

---

### 3. Forgot Password

**POST /api/auth/forgot-password**

```json
{
  "email": "caspar.georgiy@freedrops.org"
}
```
_Response:_ Password reset link sent to email.

---

### 4. Reset Password

**POST /api/auth/reset-password**

```json
{
  "token": "<reset-token-from-email>",
  "password": "NewPassword123!"
}
```
_Response:_ Password reset successful.

---

**Continue with other flows (e.g., creating products, onboarding drivers/trucks, etc.) as documented above.**
