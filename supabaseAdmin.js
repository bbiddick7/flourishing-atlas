// Server-side Supabase client. Uses the SERVICE-ROLE key, which bypasses
// Row-Level Security. This key must NEVER reach the browser — it lives only in
// serverless function env vars (no VITE_ prefix). All credit writes go through here.
import { createClient } from "@supabase/supabase-js";

let cached = null;

export function getAdminClient() {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

// Verify a user's access token (sent from the browser) and return their identity.
// This is how a serverless function knows WHICH user is calling, without trusting
// a user-supplied id. The token is issued by Supabase Auth and verified here.
export async function getUserFromToken(accessToken) {
  if (!accessToken) return null;
  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}
