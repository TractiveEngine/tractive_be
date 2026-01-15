# Firebase Cloud Messaging Setup Guide

## ✅ What You've Completed

- ✅ Created Firebase project
- ✅ Registered web app
- ✅ Generated service account JSON file
- ✅ Generated Web Push certificate (VAPID key)
- ✅ Firebase Cloud Messaging API (V1) is enabled

---

## 📝 **Next: Fill in Environment Variables**

### **Step 1: Open Your Service Account JSON File**

The file you downloaded is named something like:
`tractive-notifications-firebase-adminsdk-xxxxx-123456.json`

Open it in a text editor. It looks like this:

```json
{
  "type": "service_account",
  "project_id": "tractive-notifications",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@tractive-notifications.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

---

### **Step 2: Update `.env.local` File**

Open your `.env.local` file and replace the placeholder values:

#### **Backend Variables (from Service Account JSON):**

```bash
# Replace these with values from your service account JSON file:

FIREBASE_PROJECT_ID=tractive-notifications
# ↑ Copy from "project_id" in JSON

FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tractive-notifications.iam.gserviceaccount.com
# ↑ Copy from "client_email" in JSON

FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
# ↑ Copy from "private_key" in JSON (keep the quotes and \n characters!)
```

#### **Frontend Variables (from Firebase Console):**

Go back to Firebase Console → Project Settings → General tab

You should see your web app config. Copy these values:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tractive-notifications.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tractive-notifications
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tractive-notifications.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=738333120206
# ↑ This is your Sender ID from the Cloud Messaging tab

NEXT_PUBLIC_FIREBASE_APP_ID=1:738333120206:web:abcdef123456
# ↑ From the web app config

NEXT_PUBLIC_FIREBASE_VAPID_KEY=BPxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# ↑ This is the Web Push certificate you generated
```

---

### **Step 3: Verify Your Values**

**Please confirm you have:**

1. ✅ **Service Account JSON file** opened
2. ✅ **Firebase Console** open (Project Settings → General)
3. ✅ **Web Push Certificate** (VAPID key) copied

**Then share with me:**
- Your Firebase **project_id** (e.g., "tractive-notifications")
- Confirm you've copied the values to `.env.local`

Once confirmed, I'll:
1. ✅ Create the Firebase initialization file
2. ✅ Update the notification helper to send push notifications
3. ✅ Extend the User model to store FCM tokens
4. ✅ Create an endpoint to register device tokens
5. ✅ Create frontend integration guide
6. ✅ Test the real-time notifications

---

## 🎯 **What Happens Next**

Once we integrate Firebase:

1. **User logs in** → Frontend requests notification permission
2. **Permission granted** → Frontend gets FCM token
3. **Token saved** → Frontend sends token to backend (`POST /api/notifications/register-device`)
4. **Backend stores token** → Saved in User model
5. **Event happens** (e.g., new order) → Backend creates notification in DB
6. **Push notification sent** → Firebase sends real-time push to user's browser
7. **User sees notification** → Instantly! Even if tab is in background

**Ready to proceed?** Just confirm you've updated the `.env.local` file with your Firebase credentials! 🚀