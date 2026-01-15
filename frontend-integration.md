# Frontend Integration Guide for Tractive API (Next.js)

## Authentication & Session

- After login (`/api/auth/login`), you receive a JWT token.
- Store this token in your session (e.g., next-auth, cookies, or localStorage).
- For all authenticated API requests, include the token in the `Authorization` header:

  ```
  Authorization: Bearer <token>
  ```

## Getting the Current User

- Call `/api/profile` with the token to get the current user's profile and roles.
- Example:

  ```js
  const res = await fetch("/api/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { user } = await res.json();
  ```

- Response includes `roles` (array), `activeRole`, and profile fields.

---

## Farmers Management

- **Get Farmers**

  ```
  GET /api/farmers
  ```

  **Query Params**: `{}` (none)

- **Create Farmer**

  ```
  POST /api/farmers
  ```

  **Body**:

  ```json
  {
    "name": "string (required)",
    "phone": "string",
    "businessName": "string",
    "nin": "string",
    "businessCAC": "string",
    "address": "string",
    "country": "string",
    "state": "string",
    "lga": "string",
    "villageOrLocalMarket": "string"
  }
  ```

- **Delete Farmer**

  ```
  DELETE /api/farmers/:id
  ```

---

## Products Management

- **Get Products**

  ```
  GET /api/products
  ```

  **Query Params**:

  ```json
  {
    "search": "string",
    "status": "active | out_of_stock",
    "year": "string (e.g., 2024)",
    "month": "string (e.g., Jan, Feb)",
    "page": "number",
    "limit": "number"
  }
  ```

- **Get Out-of-Stock Products**

  ```
  GET /api/products/out-of-stock
  ```

- **Create Product**

  ```
  POST /api/products
  ```

  **Body**:

  ```json
  {
    "name": "string (required)",
    "description": "string",
    "price": "number (required)",
    "quantity": "number (required)",
    "categories": "string[]",
    "images": "string[]",
    "farmerId": "string"
  }
  ```

- **Update Product Status**

  ```
  PATCH /api/products/:id/status
  ```

  **Body**:

  ```json
  {
    "status": "active | out_of_stock"
  }
  ```

- **Delete Product**

  ```
  DELETE /api/products/:id
  ```

- **Bulk Delete Products**

  ```
  POST /api/products/bulk/delete
  ```

  **Body**:

  ```json
  {
    "productIds": "string[]"
  }
  ```

- **Bulk Update Product Status**

  ```
  PATCH /api/products/bulk/status
  ```

  **Body**:

  ```json
  {
    "productIds": "string[]",
    "status": "active | out_of_stock"
  }
  ```

---

## Orders Management

- **Get Orders**

  ```
  GET /api/orders
  ```

  **Query Params**:

  ```json
  {
    "search": "string (in item, ID, buyer)",
    "status": "parked | delivered | pending",
    "year": "string",
    "month": "string",
    "buyer": "string",
    "location": "string"
  }
  ```

- **Get Order Details**

  ```
  GET /api/orders/:id
  ```

- **Update Order Status**

  ```
  PATCH /api/orders/:id/status
  ```

  **Body**:

  ```json
  {
    "status": "parked | delivered"
  }
  ```

---

## Transactions Management

- **Get Transactions**

  ```
  GET /api/transactions
  ```

  **Query Params**:

  ```json
  {
    "status": "pending | approved",
    "search": "string (item, ID, buyer)",
    "year": "string",
    "month": "string"
  }
  ```

- **Update Transaction Status**

  ```
  PATCH /api/transactions/:id/status
  ```

  **Body**:

  ```json
  {
    "status": "pending | approved"
  }
  ```

- **Contact Customer Care**

  ```
  POST /api/transactions/:id/contact-customer-care
  ```

  **Body**:

  ```json
  {
    "message": "string",
    "priority": "low | medium | high"
  }
  ```

---

## Customers Management

- **Get Customers**

  ```
  GET /api/customers
  ```

  **Query Params**:

  ```json
  {
    "search": "string (by name)",
    "location": "string"
  }
  ```

- **Get Customer Profile**

  ```
  GET /api/customers/:id
  ```

- **Initiate Chat**

  ```
  POST /api/customers/:id/chat
  ```

  **Body**:

  ```json
  {
    "message": "string",
    "subject": "string"
  }
  ```

---

## Reviews Management

- **Get Reviews**

  ```
  GET /api/reviews
  ```

  **Query Params**:

  ```json
  {
    "search": "string (customer name or content)",
    "rating": "number (1-5)",
    "dateFrom": "YYYY-MM-DD",
    "dateTo": "YYYY-MM-DD"
  }
  ```

- **Reply to Review**

  ```
  POST /api/reviews/:id/reply
  ```

  **Body**:

  ```json
  {
    "message": "string"
  }
  ```

- **Like Review**

  ```
  POST /api/reviews/:id/like
  ```

- **Get Reviews Summary**

  ```
  GET /api/reviews/summary
  ```

---

## Error Handling

**Error Response Format**

```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

---

## Common Status Codes

```json
{
  "200": "Success",
  "201": "Created",
  "400": "Validation Error",
  "401": "Unauthorized",
  "403": "Forbidden",
  "404": "Not Found",
  "500": "Server Error"
}
```

---

## Validation Notes

```json
{
  "phone": "must follow Nigerian format",
  "email": "must be valid",
  "price/amount": "must be positive number",
  "status": "must be one of predefined values"
}
```

---

## Pagination

```json
{
  "page": "number (default 1)",
  "limit": "number (default 20, max 100)"
}
```

---

## Search & Filtering

```json
{
  "caseInsensitive": true,
  "partialMatching": true,
  "dateRangeInclusive": true
}
```

---

## Implementation Notes

```json
{
  "timestamps": "ISO 8601 format",
  "monetaryValues": "return as numbers",
  "CORS": "enabled for frontend domains",
  "rateLimiting": true,
  "indexing": "for searchable fields",
  "softDelete": true,
  "tracking": ["createdBy", "updatedBy"]
}
```

---

## Priority for Backend Implementation

```json
{
  "1": "Farmers & Products",
  "2": "Orders & Transactions",
  "3": "Customers & Reviews"
}
```

---
