# 🔐 Password Reset Flow - Updated

## Overview
The password reset flow has been updated to use a **6-digit code** instead of a reset link, making it consistent with the email verification flow.

---

## ✨ What Changed

### Before (Old Flow)
1. User requests password reset
2. System sends email with a **long token link**
3. User clicks link with token in URL
4. User enters new password
5. System validates token and updates password

### After (New Flow) ✅
1. User requests password reset
2. System sends email with a **6-digit code**
3. User enters email + code + new password
4. System validates code and updates password

---

## 🎯 Benefits

1. **Consistency**: Same pattern as email verification (6-digit code)
2. **User-Friendly**: Easy to type, no need to click links
3. **Mobile-Friendly**: Easier to copy/paste codes on mobile
4. **Secure**: Code expires in 1 hour
5. **Simple**: No URL parameters to manage

---

## 📋 API Changes

### 1. Forgot Password Endpoint
**Endpoint:** `POST /api/auth/forgot-password`

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If your email exists, you will receive a reset code."
}
```

**What Happens:**
- Generates a 6-digit code (e.g., "123456")
- Saves code to user's `resetPasswordToken` field
- Sets expiry to 1 hour from now
- Sends email with the code

---

### 2. Reset Password Endpoint
**Endpoint:** `POST /api/auth/reset-password`

**Request (Updated):**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "password": "NewSecurePass456!"
}
```

**Response:**
```json
{
  "message": "Password reset successful",
  "success": true
}
```

**Validation:**
- Email must exist
- Code must match the stored code
- Code must not be expired (< 1 hour old)
- Password must meet requirements

---

## 📧 Email Template

### New Email Design
The reset password email now displays:
- ✅ Large, centered 6-digit code
- ✅ Code expiry time (1 hour)
- ✅ Security warning
- ✅ Step-by-step instructions
- ✅ Professional styling

### Example Email:
```
Reset Your Password

Hi John Doe,

You requested to reset your password. Use the code below:

┌─────────────────┐
│   1 2 3 4 5 6   │
│ This code expires in 1 hour
└─────────────────┘

⚠️ Security Notice: If you did not request this, ignore this email.

To reset your password:
1. Enter your email address
2. Enter the 6-digit code above
3. Create your new password

Best regards,
Tractive Engine Team
```

---

## 🧪 Testing the New Flow

### Step 1: Request Reset Code
```bash
POST http://localhost:3000/api/auth/forgot-password

Body:
{
  "email": "test@example.com"
}

✅ Expected: 200 OK
📝 Check console for the 6-digit code
```

### Step 2: Reset Password with Code
```bash
POST http://localhost:3000/api/auth/reset-password

Body:
{
  "email": "test@example.com",
  "code": "123456",
  "password": "NewPassword123!"
}

✅ Expected: 200 OK with success message
```

### Step 3: Login with New Password
```bash
POST http://localhost:3000/api/auth/login

Body:
{
  "email": "test@example.com",
  "password": "NewPassword123!"
}

✅ Expected: 200 OK with JWT token
```

---

## 🔒 Security Features

1. **Code Expiry**: Codes expire after 1 hour
2. **One-Time Use**: Code is deleted after successful reset
3. **Email Verification**: Must provide email + code (2-factor)
4. **Rate Limiting**: Consider adding rate limiting to prevent abuse
5. **Secure Response**: Same response whether email exists or not

---

## 🎨 Frontend Integration

### Example React Component
```jsx
function ResetPassword() {
  const [step, setStep] = useState(1); // 1: request code, 2: reset password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const requestCode = async () => {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (response.ok) {
      setStep(2);
      alert('Check your email for the reset code');
    }
  };

  const resetPassword = async () => {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, password })
    });
    
    if (response.ok) {
      alert('Password reset successful! You can now login.');
      // Redirect to login page
    }
  };

  return (
    <div>
      {step === 1 ? (
        <div>
          <h2>Forgot Password</h2>
          <input 
            type="email" 
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button onClick={requestCode}>Send Reset Code</button>
        </div>
      ) : (
        <div>
          <h2>Reset Password</h2>
          <input 
            type="text" 
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
          />
          <input 
            type="password" 
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={resetPassword}>Reset Password</button>
        </div>
      )}
    </div>
  );
}
```

---

## 📊 Comparison with Email Verification

Both flows now use the same pattern:

| Feature | Email Verification | Password Reset |
|---------|-------------------|----------------|
| Code Type | 6-digit | 6-digit |
| Expiry | 24 hours | 1 hour |
| Storage Field | `verificationCode` | `resetPasswordToken` |
| Expiry Field | `verificationTokenExpiry` | `resetPasswordTokenExpiry` |
| Email Template | `verification.html` | `reset-password.html` |
| Endpoint | `/api/auth/verify-code` | `/api/auth/reset-password` |

---

## 🐛 Error Handling

### Common Errors

**Invalid Code:**
```json
{
  "error": "Invalid or expired code"
}
```

**Missing Fields:**
```json
{
  "error": "Email, code, and new password required"
}
```

**Expired Code:**
```json
{
  "error": "Invalid or expired code"
}
```

---

## ✅ Migration Notes

### For Existing Users
- Old reset tokens (long hex strings) will still work until they expire
- New requests will generate 6-digit codes
- No database migration needed (same fields used)

### For Frontend Developers
- Update reset password form to accept: email + code + password
- Remove token parameter from URL
- Update UI to show code input field (6 digits)
- Add code expiry timer (optional)

---

## 🎉 Summary

The password reset flow is now:
- ✅ More user-friendly (6-digit code)
- ✅ Consistent with email verification
- ✅ Mobile-friendly
- ✅ Secure (1-hour expiry)
- ✅ Simple to implement

**Files Updated:**
1. `src/app/api/auth/forgot-password/route.ts` - Generate 6-digit code
2. `src/app/api/auth/reset-password/route.ts` - Accept email + code + password
3. `email-templates/reset-password.html` - Display code instead of link
4. `docs/api.md` - Updated API documentation
5. `docs/Tractive-API.postman_collection.json` - Updated Postman collection

---

**Last Updated:** December 2, 2024
