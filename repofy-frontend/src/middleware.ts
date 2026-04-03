import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_ROUTES } from "@/lib/constants";

export async function middleware(request: NextRequest) {
  // Generate a per-request nonce for CSP
  const nonce = crypto.randomUUID();
  request.headers.set("x-nonce", nonce);

  const response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;

  // Read access_token HttpOnly cookie directly (server-side middleware CAN read HttpOnly cookies)
  const token = request.cookies.get("access_token")?.value?.trim();
  const isAuthenticated = !!token && token.length > 0;

  // Redirect authenticated users away from auth pages → /dashboard
  // /callback is a route handler (not a page) — it handles its own redirects
  const isAuthPage = pathname === "/login";
  if (isAuthenticated && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Protect app routes — redirect unauthenticated users to /login
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  if (!isAuthenticated && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect disabled feature sub-routes to their parent Coming Soon page
  const DISABLED_ROUTES = ["/report/", "/generate/"];
  if (DISABLED_ROUTES.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone();
    url.pathname = "/reports";
    return NextResponse.redirect(url);
  }

  // Build nonce-based Content-Security-Policy
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,

    // ACCEPTED RISK: style-src 'unsafe-inline' (Issue M4)
    //
    // 'unsafe-inline' is required here and CANNOT be replaced with nonces or hashes.
    // CSP nonces/hashes only apply to <style> tags — they do NOT cover inline
    // style="" attributes on DOM elements (per the CSP spec, Level 3 §6.7.2).
    //
    // framer-motion (used in 40+ components) animates by setting element.style
    // properties directly (transform, opacity, y, x, scale). There is no
    // framer-motion API or plugin to route these through <style> tags or CSS
    // classes — this is fundamental to how WAAPI-based animation libraries work.
    //
    // html2canvas-pro (PDF export) also manipulates inline styles on cloned DOM
    // nodes during rendering.
    //
    // Risk mitigation:
    //  - script-src is nonce-locked (no 'unsafe-inline'), so style injection via
    //    XSS would require script execution first, which the nonce blocks.
    //  - style-based attacks (CSS exfil) are low-severity. connect-src is
    //    restricted to 'self' only (no external domains), so exfiltration
    //    surface remains limited.
    //  - All other directives are as restrictive as possible.
    "style-src 'self' 'unsafe-inline'",

    "img-src 'self' avatars.githubusercontent.com data: blob:", // data:/blob: needed for html2canvas-pro + jspdf
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",   // jsPDF may use blob workers for PDF generation
    "object-src 'none'",
    "base-uri 'self'",           // prevent <base> tag injection attacks
    "form-action 'self'",        // restrict form submission targets
    "frame-ancestors 'none'",    // prevent clickjacking (same as X-Frame-Options: DENY)
    "frame-src 'none'",          // disallow embedding iframes
    // Only upgrade insecure requests in production — in dev, localhost is HTTP
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
