import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth provider errors (e.g. user denied consent)
  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error);
    if (errorDescription) {
      loginUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      // Validate redirect: only allow relative paths (prevent open redirect)
      const isRelative = next.startsWith("/") && !next.startsWith("//");
      const redirectPath = isRelative ? next : "/";
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
    // Forward exchange error context to login page
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_exchange_failed");
    loginUrl.searchParams.set("error_description", exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(`${origin}/login`);
}
