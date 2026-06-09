// POST /api/balance — returns the signed-in user's current credit balance.
import { getUserFromToken, getAdminClient } from "./_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { accessToken } = req.body || {};
  const user = await getUserFromToken(accessToken);
  if (!user) return res.status(401).json({ error: "Not signed in." });

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from("balances")
      .select("credits")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return res.status(200).json({ credits: data?.credits ?? 0 });
  } catch (err) {
    console.error("balance error:", err);
    return res.status(500).json({ error: "Could not read balance." });
  }
}
