// src/middleware.ts
import { NextResponse, NextRequest } from "next/server";

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://tractive-new.vercel.app",
  "https://tractive-be.vercel.app",
];

const envOriginEntries = [
  process.env.ALLOWED_ORIGINS,
  process.env.FRONTEND_ORIGIN,
  process.env.NEXT_PUBLIC_APP_URL,
]
  .filter(Boolean);

const allowedOrigins = new Set(
  [...defaultAllowedOrigins, ...envOriginEntries.join(",").split(",")]
    .map((s) => s.trim())
    .filter(Boolean)
);

/** Returns true if the given origin is allowed by exact match or ".suffix" rule. */
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    for (const entry of allowedOrigins) {
      if (entry.startsWith(".") && url.hostname.endsWith(entry)) {
        return true;
      }
    }
  } catch {
    // Invalid Origin header -> treat as not allowed
    return false;
  }

  return false;
}

export function middleware(request: NextRequest) {
  // Apply CORS only to API routes
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  const requestedHeaders =
    request.headers.get("access-control-request-headers") ||
    "Content-Type, Authorization";

  // If no Origin header (non-browser request), skip CORS enforcement
  if (!origin) {
    return NextResponse.next();
  }

  const resolvedOrigin = isAllowedOrigin(origin) ? origin : defaultAllowedOrigins[0];

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": resolvedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": requestedHeaders,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "Content-Type, Authorization",
    Vary: "Origin, Access-Control-Request-Headers",
  };

  // Strict validation: block if origin isn't explicitly allowed
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { error: "CORS not allowed for this origin" },
      { status: 403, headers: corsHeaders }
    );
  }

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const response = NextResponse.next();
  for (const [k, v] of Object.entries(corsHeaders)) {
    response.headers.set(k, v);
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
