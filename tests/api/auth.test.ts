import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTest, teardownTest } from '../setup/db';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as verifyHandler } from '@/app/api/auth/verify-code/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { GET as profileHandler } from '@/app/api/profile/route';
import { createMockRequest, createAuthenticatedRequest, getResponseJson } from '../setup/test-server';
import User from '@/models/user';

describe('Auth Flow Integration Test', () => {
  beforeEach(async () => {
    await setupTest();
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('should complete full auth flow: register → verify → login → profile', async () => {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'SecurePass123!';
    const testName = 'Test User';

    // Step 1: Register
    const registerRequest = createMockRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: {
        email: testEmail,
        password: testPassword,
        name: testName,
      },
    });

    const registerResponse = await registerHandler(registerRequest);
    const registerData = await getResponseJson(registerResponse);

    expect(registerResponse.status).toBe(201);
    expect(registerData.message).toContain('registered');
    expect(registerData.user.email).toBe(testEmail);

    // Step 2: Get verification code from database (simulating email)
    const user = await User.findOne({ email: testEmail });
    expect(user).toBeTruthy();
    expect(user?.verificationCode).toBeTruthy();

    // Step 3: Verify email
    const verifyRequest = createMockRequest('http://localhost:3000/api/auth/verify-code', {
      method: 'POST',
      body: {
        email: testEmail,
        code: user?.verificationCode,
      },
    });

    const verifyResponse = await verifyHandler(verifyRequest);
    const verifyData = await getResponseJson(verifyResponse);

    expect(verifyResponse.status).toBe(200);
    expect(verifyData.message).toContain('verified');

    // Step 4: Login
    const loginRequest = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: testPassword,
      },
    });

    const loginResponse = await loginHandler(loginRequest);
    const loginData = await getResponseJson(loginResponse);

    expect(loginResponse.status).toBe(200);
    expect(loginData.token).toBeTruthy();
    expect(loginData.user.email).toBe(testEmail);

    // Step 5: Access profile with token
    const profileRequest = createAuthenticatedRequest(
      'http://localhost:3000/api/profile',
      user!._id.toString(),
      {
        email: testEmail,
      }
    );

    const profileResponse = await profileHandler(profileRequest);
    const profileData = await getResponseJson(profileResponse);

    expect(profileResponse.status).toBe(200);
    expect(profileData.user.email).toBe(testEmail);
    expect(profileData.user.name).toBe(testName);
    expect(profileData.user.isVerified).toBe(true);
  });

  it('should reject login with incorrect password', async () => {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'SecurePass123!';

    // Register user
    const registerRequest = createMockRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      body: {
        email: testEmail,
        password: testPassword,
        name: 'Test User',
      },
    });

    await registerHandler(registerRequest);

    // Verify user
    const user = await User.findOne({ email: testEmail });
    await User.findByIdAndUpdate(user!._id, { isVerified: true });

    // Try to login with wrong password
    const loginRequest = createMockRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'WrongPassword123!',
      },
    });

    const loginResponse = await loginHandler(loginRequest);
    const loginData = await getResponseJson(loginResponse);

    expect(loginResponse.status).toBe(401);
    expect(loginData.error).toBeTruthy();
  });

  it('should reject profile access without token', async () => {
    const profileRequest = createMockRequest('http://localhost:3000/api/profile');

    const profileResponse = await profileHandler(profileRequest);
    const profileData = await getResponseJson(profileResponse);

    expect(profileResponse.status).toBe(401);
    expect(profileData.error).toBe('Unauthorized');
  });
});
