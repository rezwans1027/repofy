import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");

  if (!code) {
    url.pathname = "/login";
    url.searchParams.set("error", "missing_code");
    return NextResponse.redirect(url);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[callback] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    url.pathname = "/login";
    url.searchParams.set("error", "server_misconfigured");
    return NextResponse.redirect(url);
  }

  const backendUrl = process.env.API_BACKEND_URL || "http://localhost:3001/api";

  // Create a response we can set cookies on
  const response = NextResponse.redirect(new URL("/dashboard", request.url));

  // Create server-side Supabase client that reads/writes cookies on the request/response
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Exchange the PKCE code for a session (server-side has access to the code verifier cookie)
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("[callback] Exchange failed:", error?.message);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", error?.message || "exchange_failed");
    return NextResponse.redirect(loginUrl);
  }

  const { access_token, refresh_token, provider_token } = data.session;

  if (!provider_token) {
    console.error("[callback] No provider_token in session");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "no_provider_token");
    return NextResponse.redirect(loginUrl);
  }

  // POST to backend to store GitHub token and set auth cookies
  try {
    const backendRes = await fetch(`${backendUrl}/auth/github-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token, refresh_token, provider_token }),
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
