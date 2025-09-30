# Frontend Integration Guide for Tractive API (Next.js)

## Authentication & Session

- After login (`/api/auth/login`), you receive a JWT token.
- Store this token in your session (e.g., using next-auth, cookies, or localStorage).
- For all authenticated API requests, include the token in the `Authorization` header:
  ```
  Authorization: Bearer <token>
  ```

## Getting the Current User

- To get the current user's profile and roles, call `/api/profile` with the token in the header.
- Example:
  ```js
  const res = await fetch("/api/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { user } = await res.json();
  ```
- The response includes all user info, including `roles` (array), `activeRole`, and profile fields.

## Role-based UI

- Use `user.roles` (array) to determine what the user can do (e.g., show agent dashboard if `roles.includes('agent')`).
- Use `user.activeRole` if you want to show the UI for the currently selected role.

## Session Management

- You can decode the JWT on the client (with [jwt-decode](https://www.npmjs.com/package/jwt-decode)) for quick access to userId/email, but always use `/api/profile` for the latest user info.
- If using [next-auth](https://next-auth.js.org/), you can create a custom provider that uses your login endpoint and stores the JWT in the session.

## CORS

- CORS is enabled for your frontend origin(s), so you can call the API from your Next.js frontend without issues.

## Summary

- Login → store token → use token for all API requests.
- Call `/api/profile` to get the current user and roles.
- Use roles to control access and UI.
- For more info, see the API docs and usage guide in this repo.

If you have questions or need a Next.js example, let the backend team know!
