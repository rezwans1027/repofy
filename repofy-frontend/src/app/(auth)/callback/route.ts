import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    url.pathname = "/login";
    url.searchParams.set("error", "missing_code");
    return NextResponse.redirect(url);
  }

  // ── CSRF: validate state ──────────────────────────────────────────

  const storedState = request.cookies.get("github_oauth_state")?.value;
  if (!storedState) {
    url.pathname = "/login";
    url.searchParams.set("error", "missing_state");
    return NextResponse.redirect(url);
  }

  if (state !== storedState) {
    url.pathname = "/login";
    url.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(url);
  }

  // ── PKCE: extract code_verifier ───────────────────────────────────

  const codeVerifier = request.cookies.get("github_oauth_code_verifier")?.value;
  if (!codeVerifier) {
    url.pathname = "/login";
    url.searchParams.set("error", "missing_verifier");
    return NextResponse.redirect(url);
  }

  // ── Clear OAuth cookies ───────────────────────────────────────────

  const isProduction = process.env.NODE_ENV === "production";
  const response = NextResponse.redirect(new URL("/dashboard", request.url));

  // Clear with matching attributes so the browser actually removes them
  const clearOpts = {
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    ...(isProduction && { secure: true }),
  };
  response.cookies.set("github_oauth_state", "", clearOpts);
  response.cookies.set("github_oauth_code_verifier", "", clearOpts);

  // ── Exchange code via backend ─────────────────────────────────────

  const backendUrl = process.env.API_BACKEND_URL || "http://localhost:3001/api";
  const redirectUri = `${url.origin}/callback`;

  try {
    const backendRes = await fetch(`${backendUrl}/auth/github-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier: codeVerifier }),
    });

    if (!backendRes.ok) {
      const json = await backendRes.json().catch(() => null);
      console.error("[callback] Backend error:", backendRes.status, json);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", json?.error || "backend_error");
      return NextResponse.redirect(loginUrl);
    }

    // Copy auth cookies from backend response to our redirect response
    const setCookies = backendRes.headers.getSetCookie();
    for (const cookie of setCookies) {
      response.headers.append("Set-Cookie", cookie);
    }
  } catch (err) {
    console.error("[callback] Backend fetch failed:", err);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "backend_unreachable");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
