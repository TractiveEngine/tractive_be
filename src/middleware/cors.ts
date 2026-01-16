import { NextResponse } from "next/server";

const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

export function middleware(_request: Request) {
  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
