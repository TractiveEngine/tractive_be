import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth';

/**
 * Create a mock NextRequest for testing Next.js route handlers
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options;

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(url, requestInit);
}

/**
 * Create an authenticated request with JWT token
 */
export function createAuthenticatedRequest(
  url: string,
  userId: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    email?: string;
    role?: string;
  } = {}
): NextRequest {
  const { email, role, ...requestOptions } = options;
  
  const token = signToken({ 
    userId, 
    email: email || 'test@example.com',
    role: role || 'buyer'
  });

  return createMockRequest(url, {
    ...requestOptions,
    headers: {
      ...requestOptions.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Helper to extract JSON from NextResponse
 */
export async function getResponseJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Helper to call a route handler and get parsed response
 */
export async function callRouteHandler(
  handler: (req: NextRequest) => Promise<Response>,
  request: NextRequest
) {
  const response = await handler(request);
  const data = await getResponseJson(response);
  return {
    status: response.status,
    data,
    response,
  };
}
