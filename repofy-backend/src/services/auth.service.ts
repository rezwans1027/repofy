import { getSupabaseAuth } from "../config/supabase-auth";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function refreshSession(
  refreshToken: string,
): Promise<{ session: { access_token: string; refresh_token: string }; user: { id: string; email: string; display_name?: string } }> {
  const { data, error } = await getSupabaseAuth().auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    throw new AuthError("Session expired", 401);
  }

  return {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    user: {
      id: data.user!.id,
      email: data.user!.email ?? "",
      display_name: data.user!.user_metadata?.display_name,
    },
  };
}
