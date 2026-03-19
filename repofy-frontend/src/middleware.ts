import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_ROUTES } from "@/lib/constants";

function getApiOrigin(apiUrl: string): string {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return apiUrl;
  }
}

export async function middleware(request: NextRequest) {
  // Generate a per-request nonce for CSP
  const nonce = crypto.randomUUID();
  request.headers.set("x-nonce", nonce);

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars",
    );
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Redirect authenticated users away from auth pages → /dashboard
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Protect app routes — redirect unauthenticated users to /login
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  if (!user && isProtected) {
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const apiOrigin = getApiOrigin(apiUrl);
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
    //  - style-based attacks (CSS exfil) are low-severity and mitigated by the
    //    restrictive connect-src limiting data exfiltration endpoints.
    //  - All other directives are as restrictive as possible.
    "style-src 'self' 'unsafe-inline'",

    "img-src 'self' avatars.githubusercontent.com data: blob:", // data:/blob: needed for html2canvas-pro + jspdf
    "font-src 'self'",
    `connect-src 'self' ${supabaseUrl} ${apiOrigin}`,
    "worker-src 'self' blob:",   // jsPDF may use blob workers for PDF generation
    "object-src 'none'",
    "base-uri 'self'",           // prevent <base> tag injection attacks
    "form-action 'self'",        // restrict form submission targets
    "frame-ancestors 'none'",    // prevent clickjacking (same as X-Frame-Options: DENY)
    "frame-src 'none'",          // disallow embedding iframes
    // Only upgrade insecure requests in production — in dev, localhost is HTTP
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  supabaseResponse.headers.set("Content-Security-Policy", csp);

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
