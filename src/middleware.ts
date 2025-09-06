// src/middleware.ts
import { NextResponse, NextRequest } from "next/server";

const envList =
  process.env.ALLOWED_ORIGINS ??
  process.env.FRONTEND_ORIGIN ?? // optional fallback for single origin setups
  "http://localhost:3000";

const allowedOrigins = new Set(
  envList
    .split(",")
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

  // If no Origin header (non-browser request), skip CORS enforcement
  if (!origin) {
    return NextResponse.next();
  }

  // Strict validation: block if origin isn't explicitly allowed
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json(
      { error: "CORS not allowed for this origin" },
      { status: 403 }
    );
  }

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": origin, // echo back the validated origin
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };

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
