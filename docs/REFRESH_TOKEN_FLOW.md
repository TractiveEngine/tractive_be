# Refresh Token Flow (Next.js Frontend Guide)

This backend now uses httpOnly refresh-token cookies for maximum security. The access token remains short-lived and is returned in JSON.

## What the backend does

- /api/auth/login
  - Returns access token in JSON: { token, user, ... }
  - Sets refreshToken as httpOnly cookie (30 days)

- /api/auth/refresh
  - If refresh token cookie exists, you can call with an empty body
  - Returns new access token (and rotates refresh cookie)

- /api/auth/logout
  - Clears refresh token cookie

## Frontend Responsibilities (Next.js)

1) Store ONLY the access token in memory (or short-term storage).
2) DO NOT store the refresh token in JS (cookie handles it).
3) On 401 responses, call /api/auth/refresh and retry.
4) If refresh fails (401), redirect to login.

## Basic Request Flow

- Login:
  POST /api/auth/login
  -> Save access token (in memory or short-term storage)

- Normal API call:
  Authorization: Bearer <accessToken>

- If response is 401 (expired):
  POST /api/auth/refresh (no body)
  -> Save new access token
  -> Retry original request

- Logout:
  POST /api/auth/logout
  -> Clear access token from storage

## Sample Fetch Wrapper (browser)

```ts
export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  const accessToken = localStorage.getItem('accessToken');
  const headers = {
    ...(init.headers || {}),
    Authorization: accessToken ? `Bearer ${accessToken}` : ''
  };

  let res = await fetch(input, { ...init, headers, credentials: 'include' });
  if (res.status !== 401) return res;

  // Refresh (cookie-based)
  const refreshRes = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include'
  });

  if (!refreshRes.ok) return res;

  const data = await refreshRes.json();
  localStorage.setItem('accessToken', data.token);

  const retryHeaders = {
    ...(init.headers || {}),
    Authorization: `Bearer ${data.token}`
  };
  return fetch(input, { ...init, headers: retryHeaders, credentials: 'include' });
}
```

## Notes

- Always include `credentials: 'include'` so the refresh cookie is sent.
- Access tokens should be treated as short‑lived and rotated via refresh.
- If you prefer Axios, use an interceptor with the same logic.

## Optional: Proactive Refresh (before expiry)

Instead of waiting for a 401, you can proactively refresh when the access token is close to expiring.

Example:
```ts
function getJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function ensureFreshToken() {
  const token = localStorage.getItem('accessToken');
  if (!token) return;
  const exp = getJwtExp(token);
  if (!exp) return;
  const now = Date.now();
  const bufferMs = 2 * 60 * 1000; // 2 minutes
  if (exp - now <= bufferMs) {
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      localStorage.setItem('accessToken', data.token);
    }
  }
}
```

When to call:
- On app load
- Before making API calls (optional)
