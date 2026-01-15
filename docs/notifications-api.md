# Notifications API Documentation

## Overview

The Tractive Notifications API provides a real-time notification system for users to receive updates about bids, orders, transactions, shipping, support tickets, and chat messages.

**Base URL:** `https://your-domain.com/api`

**Authentication:** All endpoints require JWT Bearer token in the Authorization header.

---

## Notification Types

The system supports the following notification types:

| Type | Description | Triggered When |
|------|-------------|----------------|
| `bid_created` | New bid received on your product | Someone places a bid on your product |
| `bid_accepted` | Your bid was accepted | Agent accepts your bid |
| `order_created` | New order placed | Order is created (sent to buyer & seller) |
| `order_status_changed` | Order status updated | Order status changes (pending→paid→delivered) |
| `transaction_approved` | Transaction approved | Admin approves your transaction |
| `transaction_declined` | Transaction declined | Admin declines your transaction |
| `transaction_refunded` | Transaction refunded | Admin processes a refund |
| `shipping_accepted` | Shipping offer accepted | Buyer accepts your shipping offer |
| `shipping_rejected` | Shipping offer rejected | Buyer rejects your shipping offer |
| `support_ticket_updated` | Support ticket updated | Admin updates your ticket status |
| `chat_message` | New chat message | Someone sends you a message |
| `generic` | General notification | System-generated notifications |

---

## Endpoints

### 1. Get Notifications

Retrieve a paginated list of notifications for the authenticated user.

**Endpoint:** `GET /api/notifications`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `isRead` | boolean | No | - | Filter by read status (true/false) |
| `page` | number | No | 1 | Page number for pagination |
| `limit` | number | No | 20 | Number of items per page |

**Example Request:**
```bash
GET /api/notifications?isRead=false&page=1&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "user": "507f1f77bcf86cd799439012",
        "type": "order_created",
        "title": "Order created successfully",
        "message": "Your order of 1500 has been created",
        "metadata": {
          "orderId": "507f1f77bcf86cd799439013",
          "totalAmount": 1500,
          "productsCount": 3
        },
        "isRead": false,
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439014",
        "user": "507f1f77bcf86cd799439012",
        "type": "bid_accepted",
        "title": "Your bid was accepted",
        "message": "Your bid of 500 on Fresh Tomatoes was accepted",
        "metadata": {
          "productId": "507f1f77bcf86cd799439015",
          "bidId": "507f1f77bcf86cd799439016",
          "amount": 500
        },
        "isRead": true,
        "createdAt": "2024-01-14T15:20:00.000Z",
        "updatedAt": "2024-01-14T16:00:00.000Z"
      }
    ],
    "unreadCount": 5,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

**Error Responses:**

```json
// 401 Unauthorized
{
  "success": false,
  "message": "Authentication required"
}
```

---

### 2. Mark All Notifications as Read

Mark all notifications for the authenticated user as read (or unread).

**Endpoint:** `PATCH /api/notifications`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body (Optional):**
```json
{
  "isRead": true  // Optional, defaults to true
}
```

**Example Request:**
```bash
PATCH /api/notifications
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "isRead": true
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "modifiedCount": 5
  },
  "message": "5 notifications marked as read"
}
```

---

### 3. Mark Single Notification as Read/Unread

Update the read status of a specific notification.

**Endpoint:** `PATCH /api/notifications/:id`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Notification ID |

**Request Body:**
```json
{
  "isRead": true  // Required: true or false
}
```

**Example Request:**
```bash
PATCH /api/notifications/507f1f77bcf86cd799439011
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "isRead": true
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "user": "507f1f77bcf86cd799439012",
    "type": "order_created",
    "title": "Order created successfully",
    "message": "Your order of 1500 has been created",
    "metadata": {
      "orderId": "507f1f77bcf86cd799439013",
      "totalAmount": 1500
    },
    "isRead": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  },
  "message": "Notification marked as read"
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "success": false,
  "message": "Invalid notification ID format"
}

// 404 Not Found
{
  "success": false,
  "message": "Notification not found"
}
```

---

### 4. Delete Notification

Delete a specific notification.

**Endpoint:** `DELETE /api/notifications/:id`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Notification ID |

**Example Request:**
```bash
DELETE /api/notifications/507f1f77bcf86cd799439011
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

**Error Responses:**

```json
// 404 Not Found
{
  "success": false,
  "message": "Notification not found"
}
```

---

## Frontend Implementation Guide

### Polling Strategy (Recommended for MVP)

Since this is a REST API system, the frontend should poll for new notifications periodically.

**Example Implementation (React/Next.js):**

```typescript
import { useEffect, useState } from 'react';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  metadata: any;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications?limit=20', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isRead: true })
      });
      
      // Refresh notifications
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // Mark single notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isRead: true })
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Update local state
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchNotifications();
    
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAllAsRead,
    markAsRead,
    deleteNotification
  };
}
```

**Usage in Component:**

```tsx
function NotificationBell() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();

  return (
    <div className="notification-bell">
      <button className="bell-icon">
        🔔
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>
      
      <div className="notification-dropdown">
        <div className="header">
          <h3>Notifications</h3>
          <button onClick={markAllAsRead}>Mark all as read</button>
        </div>
        
        <div className="notification-list">
          {notifications.map(notification => (
            <div 
              key={notification._id}
              className={notification.isRead ? 'read' : 'unread'}
              onClick={() => markAsRead(notification._id)}
            >
              <h4>{notification.title}</h4>
              <p>{notification.message}</p>
              <small>{new Date(notification.createdAt).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Notification Metadata by Type

Each notification type includes specific metadata that can be used for navigation or additional context:

### `bid_created`
```json
{
  "productId": "string",
  "bidId": "string",
  "amount": number,
  "buyerName": "string"
}
```

### `bid_accepted`
```json
{
  "productId": "string",
  "bidId": "string",
  "amount": number
}
```

### `order_created`
```json
{
  "orderId": "string",
  "totalAmount": number,
  "productsCount": number,
  "buyerName": "string" // Only for sellers
}
```

### `order_status_changed`
```json
{
  "orderId": "string",
  "oldStatus": "string",
  "newStatus": "string",
  "totalAmount": number,
  "transportStatus": "string" // Optional
}
```

### `transaction_approved` / `transaction_declined` / `transaction_refunded`
```json
{
  "transactionId": "string",
  "amount": number,
  "orderId": "string",
  "reason": "string" // Only for refunded
}
```

### `shipping_accepted` / `shipping_rejected`
```json
{
  "negotiationId": "string",
  "shippingRequestId": "string",
  "amount": number,
  "weightInKG": number
}
```

### `support_ticket_updated`
```json
{
  "ticketId": "string",
  "status": "string",
  "subject": "string"
}
```

### `chat_message`
```json
{
  "conversationId": "string",
  "messageId": "string",
  "senderId": "string"
}
```

---

## Best Practices

### 1. **Polling Frequency**
- Poll every 30-60 seconds for new notifications
- Increase frequency when user is actively using the app
- Decrease frequency when tab is inactive

### 2. **Unread Badge**
- Display unread count prominently in the UI
- Update badge immediately after marking as read

### 3. **Navigation**
- Use metadata to navigate to relevant pages when notification is clicked
- Example: Click order notification → Navigate to `/orders/{orderId}`

### 4. **Notification Sounds** (Optional)
- Play a subtle sound when new notifications arrive
- Allow users to enable/disable sounds in settings

### 5. **Mark as Read Strategy**
- Mark as read when user clicks on the notification
- Or mark as read when notification dropdown is opened

### 6. **Pagination**
- Load more notifications as user scrolls
- Keep initial load small (20 items) for performance

---

## Future Enhancements

### Real-Time Notifications (WebSocket)
For real-time push notifications, you can later integrate:
- **Socket.io** - For WebSocket connections
- **Server-Sent Events (SSE)** - For one-way server push
- **Firebase Cloud Messaging** - For mobile push notifications

The current REST API will remain as the source of truth, with real-time updates as an enhancement layer.

---

## Testing

### Test Accounts
Use these scenarios to test notifications:

1. **Bid Notifications**: Create a bid on a product
2. **Order Notifications**: Place an order
3. **Transaction Notifications**: Have admin approve/decline a transaction
4. **Shipping Notifications**: Accept/reject a shipping offer
5. **Support Notifications**: Have admin update a support ticket
6. **Chat Notifications**: Send a chat message

### Postman Collection
Import the API endpoints into Postman for easy testing.

---

## Support

For questions or issues with the Notifications API, contact the backend team or refer to the main API documentation at `/api-docs`.
