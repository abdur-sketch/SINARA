import authMiddleware from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import type { NextRequest, NextFetchEvent } from "next/server";

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  return authMiddleware(request as NextRequestWithAuth, event);
}

export const config = {
  matcher: ["/dashboard/:path*", "/employees/:path*", "/organization/:path*", "/units/:path*", "/positions/:path*", "/users/:path*", "/roles/:path*", "/audit-logs/:path*", "/settings/:path*"]
};
