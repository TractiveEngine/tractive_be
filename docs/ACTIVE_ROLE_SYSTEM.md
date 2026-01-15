# 🔄 Active Role System - Best Practice Implementation

## ✅ Updated Approach: Check `activeRole`

We now use **`activeRole`** for authorization instead of just checking the `roles` array.

---

## 🎯 Why This is Better

### Before (Checking `roles` array only)
```typescript
// ❌ Old way
if (user.roles.includes('agent')) {
  // Can create products
}
```

**Problems:**
- User with `["buyer", "agent"]` can create products even when acting as buyer
- No clear intent - which role is the user using?
- Confusing UX - actions happen in wrong context
- Poor audit trail - can't track which role performed action

### After (Checking `activeRole`) ✅
```typescript
// ✅ New way
if (user.activeRole === 'agent') {
  // Can create products
}
```

**Benefits:**
- ✅ User must explicitly switch to agent role
- ✅ Clear intent - user knows which "hat" they're wearing
- ✅ Better UX - prevents accidental actions
- ✅ Better audit trail - know exactly which role was used
- ✅ Industry standard (LinkedIn, Facebook, etc.)

---

## 🔐 New Authorization Flow

### Step 1: Check User Has Role
```typescript
// First, verify user has the role in their roles array
if (!user.roles.includes('agent')) {
  return 403: "You don't have the agent role"
}
```

### Step 2: Check Active Role
```typescript
// Then, verify they're actively using that role
if (user.activeRole !== 'agent') {
  return 403: "Please switch to agent role"
}
```

---

## 🔄 Role Switching API

### Switch Active Role

**Endpoint:** `PATCH /api/profile/switch-role`

**Request:**
```json
{
  "activeRole": "agent"
}
```

**Response (Success):**
```json
{
  "message": "Successfully switched to agent role",
  "activeRole": "agent",
  "availableRoles": ["buyer", "agent"]
}
```

**Response (Error - Don't Have Role):**
```json
{
  "error": "You don't have the 'agent' role",
  "availableRoles": ["buyer"]
}
```

---

### Get Current Role Info

**Endpoint:** `GET /api/profile/switch-role`

**Response:**
```json
{
  "activeRole": "buyer",
  "availableRoles": ["buyer", "agent", "transporter"]
}
```

---

## 📋 Complete User Journey

### Scenario: User with Multiple Roles

**User Profile:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "john@example.com",
  "roles": ["buyer", "agent"],
  "activeRole": "buyer"  // Currently acting as buyer
}
```

---

### Step 1: Try to Create Product (Will Fail)

```json
POST /api/products
Authorization: Bearer TOKEN

{
  "name": "Maize",
  "price": 5000
}

❌ Response: 403 Forbidden
{
  "error": "Please switch to agent or admin role to create products",
  "currentRole": "buyer",
  "availableRoles": ["buyer", "agent"],
  "hint": "Update your active role to 'agent' or 'admin' to perform this action"
}
```

---

### Step 2: Switch to Agent Role

```json
PATCH /api/profile/switch-role
Authorization: Bearer TOKEN

{
  "activeRole": "agent"
}

✅ Response: 200 OK
{
  "message": "Successfully switched to agent role",
  "activeRole": "agent",
  "availableRoles": ["buyer", "agent"]
}
```

---

### Step 3: Create Product (Now Works)

```json
POST /api/products
Authorization: Bearer TOKEN

{
  "name": "Fresh Maize",
  "price": 5000,
  "quantity": 100,
  "farmer": "FARMER_ID"
}

✅ Response: 201 Created
{
  "message": "Product created successfully",
  "product": { ... }
}
```

---

### Step 4: Switch Back to Buyer Role

```json
PATCH /api/profile/switch-role
Authorization: Bearer TOKEN

{
  "activeRole": "buyer"
}

✅ Response: 200 OK
{
  "message": "Successfully switched to buyer role",
  "activeRole": "buyer",
  "availableRoles": ["buyer", "agent"]
}
```

---

### Step 5: Create Order (Works as Buyer)

```json
POST /api/orders
Authorization: Bearer TOKEN

{
  "products": [{"product": "PRODUCT_ID", "quantity": 10}],
  "totalAmount": 50000
}

✅ Response: 201 Created
{
  "message": "Order created successfully",
  "order": { ... }
}
```

---

## 🎨 Frontend Implementation

### React Example

```typescript
import { useState, useEffect } from 'react';

function RoleSwitcher() {
  const [currentRole, setCurrentRole] = useState('buyer');
  const [availableRoles, setAvailableRoles] = useState([]);

  // Get current role on mount
  useEffect(() => {
    fetch('/api/profile/switch-role', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => res.json())
    .then(data => {
      setCurrentRole(data.activeRole);
      setAvailableRoles(data.availableRoles);
    });
  }, []);

  // Switch role
  const switchRole = async (newRole) => {
    const response = await fetch('/api/profile/switch-role', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ activeRole: newRole })
    });

    if (response.ok) {
      const data = await response.json();
      setCurrentRole(data.activeRole);
      alert(`Switched to ${newRole} role`);
      // Refresh page or update UI
      window.location.reload();
    }
  };

  return (
    <div className="role-switcher">
      <p>Current Role: <strong>{currentRole}</strong></p>
      <select 
        value={currentRole} 
        onChange={(e) => switchRole(e.target.value)}
      >
        {availableRoles.map(role => (
          <option key={role} value={role}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## 📊 Authorization Matrix

| Action | Required Active Role | Endpoint |
|--------|---------------------|----------|
| Create Product | `agent` or `admin` | POST /api/products |
| Create Farmer | `agent` or `admin` | POST /api/farmers |
| Create Order | `buyer` | POST /api/orders |
| Create Truck | `transporter` or `admin` | POST /api/trucks |
| Create Driver | `transporter` or `admin` | POST /api/drivers |
| Approve Transaction | `admin` | PATCH /api/transactions/:id |
| View Products | Any (no auth) | GET /api/products |
| View Profile | Any authenticated | GET /api/profile |

---

## 🧪 Testing Scenarios

### Test 1: User Without Role Tries to Switch

```json
// User has roles: ["buyer"]
PATCH /api/profile/switch-role
{
  "activeRole": "agent"
}

❌ Expected: 403 Forbidden
{
  "error": "You don't have the 'agent' role",
  "availableRoles": ["buyer"]
}
```

---

### Test 2: User Switches to Valid Role

```json
// User has roles: ["buyer", "agent"]
PATCH /api/profile/switch-role
{
  "activeRole": "agent"
}

✅ Expected: 200 OK
{
  "message": "Successfully switched to agent role",
  "activeRole": "agent",
  "availableRoles": ["buyer", "agent"]
}
```

---

### Test 3: Create Product Without Switching

```json
// User has roles: ["buyer", "agent"]
// But activeRole: "buyer"

POST /api/products
{
  "name": "Maize",
  "price": 5000
}

❌ Expected: 403 Forbidden
{
  "error": "Please switch to agent or admin role to create products",
  "currentRole": "buyer",
  "availableRoles": ["buyer", "agent"],
  "hint": "Update your active role to 'agent' or 'admin' to perform this action"
}
```

---

### Test 4: Create Product After Switching

```json
// Step 1: Switch role
PATCH /api/profile/switch-role
{
  "activeRole": "agent"
}

// Step 2: Create product
POST /api/products
{
  "name": "Maize",
  "price": 5000
}

✅ Expected: 201 Created
```

---

## 🎯 Best Practices

### 1. Always Set Active Role on Login

```typescript
// After login, set default active role
if (user.roles.length === 1) {
  user.activeRole = user.roles[0];
} else {
  // Let user choose or set to most common role
  user.activeRole = user.roles.includes('buyer') ? 'buyer' : user.roles[0];
}
```

### 2. Show Role Switcher in UI

```typescript
// In your app header/navbar
<RoleSwitcher 
  currentRole={user.activeRole}
  availableRoles={user.roles}
  onSwitch={handleRoleSwitch}
/>
```

### 3. Validate on Every Protected Action

```typescript
// Backend: Always check activeRole
if (user.activeRole !== 'agent') {
  return 403 with helpful message
}
```

### 4. Provide Clear Error Messages

```typescript
// ✅ Good error message
{
  "error": "Please switch to agent role to create products",
  "currentRole": "buyer",
  "hint": "Use PATCH /api/profile/switch-role to switch roles"
}

// ❌ Bad error message
{
  "error": "Forbidden"
}
```

---

## ✅ Summary

### What Changed

**Before:**
- Checked if user has role in `roles` array
- User with `["buyer", "agent"]` could create products anytime

**After:**
- Check if user's `activeRole` matches required role
- User must explicitly switch to `agent` role before creating products

### Benefits

1. ✅ **Better UX** - User knows which role they're using
2. ✅ **Clearer Intent** - Actions match the active role
3. ✅ **Better Security** - Prevents accidental actions
4. ✅ **Better Audit Trail** - Track which role performed each action
5. ✅ **Industry Standard** - Same pattern as LinkedIn, Facebook, etc.

### New Endpoints

- `PATCH /api/profile/switch-role` - Switch active role
- `GET /api/profile/switch-role` - Get current role info

### Updated Authorization

All protected endpoints now check:
1. User has the role in `roles` array
2. User's `activeRole` matches the required role

---

**Last Updated:** December 2, 2024
**Status:** ✅ Active role system implemented
