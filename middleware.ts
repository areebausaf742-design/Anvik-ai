import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Device identity without accounts (plan §6.2).
 * A first-party id in an HttpOnly cookie, cross-checked against a
 * localStorage id client-side. Not a fingerprint: no canvas, font or
 * UA fingerprinting anywhere in this product.
 */
export function middleware(req: NextRequest) {
  const existing = req.cookies.get("anvik_dev")?.value;
  if (existing) return NextResponse.next();

  const res = NextResponse.next();
  res.cookies.set("anvik_dev", crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
