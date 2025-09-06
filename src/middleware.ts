// src/middleware.ts
import { NextResponse, NextRequest } from "next/server";

const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

export function middleware(request: NextRequest) {
  // Only apply CORS to API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") ?? "";

    // You can extend this to a whitelist if needed
    const corsOrigin =
      origin && origin === allowedOrigin ? origin : allowedOrigin;

    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
      "Access-Control-Expose-Headers": "Content-Type, Authorization",
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
