import { NextResponse } from "next/server";
import { getGitHubProfile } from "@/lib/github"; 

export async function POST(request: Request) {
  // 1. Parse the incoming JSON body
  const body = await request.json();
  
  // 2. Extract the Token and Username directly from the Frontend request
  // (We don't use "auth()" here because Supabase handles that on the client)
  const { username, token } = body;

  // 3. Validation: We MUST have a token to talk to GitHub
  if (!token) {
    return NextResponse.json({ error: "Missing GitHub Access Token" }, { status: 401 });
  }

  // 4. Logic: If no username is provided, we can't "guess" the user here easily 
  // without the session. The Frontend should ideally send the username if it's "Me".
  // However, if we really need to, we can use the token to ask GitHub "Who am I?"
  let targetUser = username;
  
  if (!targetUser) {
    // Optional: Fetch the "Viewer" (Logged in user) if no username provided
    const viewerData = await getGitHubProfile("viewer", token); // "viewer" is a special GraphQL keyword, but our function expects a username string usually.
    // Actually, let's keep it simple: Require the frontend to send the username.
    return NextResponse.json({ error: "No username provided" }, { status: 400 });
  }

  // 5. Fetch the data using the provided token
  const userData = await getGitHubProfile(targetUser, token);

  if (!userData) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(userData);
}
