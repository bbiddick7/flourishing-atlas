// POST /api/analyze
// Requires a signed-in user with credits. Spends one credit ATOMICALLY before
// running the survey. If the analysis itself fails, we refund the credit so the
// user isn't charged for a failed run.

import { getUserFromToken, getAdminClient } from "./_lib/supabaseAdmin.js";

const DOMAINS = [
  { key: "happiness", label: "Happiness & Life Satisfaction", ideal: "People broadly report contentment with their lives; daily life affords moments of ease, not just survival.", indicators: "self-reported life satisfaction, access to green space and recreation, leisure time availability" },
  { key: "health", label: "Physical & Mental Health", ideal: "Healthspan tracks lifespan; care is accessible; mental health support exists without stigma.", indicators: "healthcare access / uninsured rate, mental health provider availability, life expectancy, healthspan-lifespan gap" },
  { key: "meaning", label: "Meaning & Purpose", ideal: "People of all ages have roles that matter; work, service, and contribution are available across the whole lifespan.", indicators: "volunteering rates, civic participation, older-adult employment / engagement options" },
  { key: "character", label: "Character & Virtue", ideal: "Institutions are trustworthy; people act with integrity toward one another; corruption is low.", indicators: "institutional trust measures, local government transparency, crime / safety" },
  { key: "relationships", label: "Close Social Relationships", ideal: "Few are isolated; intergenerational connection is designed into community life, not left to chance.", indicators: "social isolation / loneliness data, community spaces, intergenerational programming" },
  { key: "structure", label: "Societal Structure (New Map of Life)", ideal: "The rigid learn-work-retire model is loosened: education, work, and leisure are redistributed across a long life; cities are age-forward.", indicators: "adult education on-ramps, age-friendly city design, housing across life stages, financial security across generations" },
];

const SYSTEM = `You are a careful civic-data analyst. You are given a location and must assess it against six dimensions of human flourishing, using ONLY information you can find via web search.

CRITICAL HONESTY RULES:
- Never invent statistics. If search does not surface a figure for a dimension, set that dimension's tier to "none" and say so plainly.
- When you cite a number, name where it appears to come from in the "evidence" field. Do not fabricate source names.
- Mark a dimension "measured" only if search returned concrete local data; "partial" if you found only proxy, regional, or indirect signals; "none" if you found nothing location-specific.
- Action steps must be things a resident or local organizer could actually do, grounded in what the place appears to lack or could build on. No generic filler.

Respond with ONLY a JSON object, no preamble, no markdown fences, in exactly this shape:
{
  "place": "resolved place name, or null if you cannot identify it",
  "placeNote": "one sentence on what you could establish about this place, or why you couldn't",
  "domains": [
    {
      "key": "happiness|health|meaning|character|relationships|structure",
      "tier": "measured|partial|none",
      "finding": "1-2 sentences on what the data shows for this place; if tier is none, say what's missing",
      "evidence": "where the info came from, or empty string",
      "actions": ["concrete local action step", "another"]
    }
  ]
}
Include all six domain keys exactly once.`;

async function refund(admin, userId) {
  // Best-effort refund of one credit after a failed run.
  try {
    await admin.rpc("grant_credits", {
      p_user_id: userId,
      p_email: null,
      p_amount: 1,
      p_stripe_event: `refund:${userId}:${Date.now()}`,
    });
  } catch (e) {
    console.error("Refund failed:", e);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Analysis isn't configured yet." });
  }

  const { location, accessToken } = req.body || {};
  const place = typeof location === "string" ? location.trim() : "";
  if (!place || place.length > 120) return res.status(400).json({ error: "Enter a valid place name." });

  const user = await getUserFromToken(accessToken);
  if (!user) return res.status(401).json({ error: "Please sign in to run a survey." });

  const admin = getAdminClient();

  // Atomically spend one credit. Returns new balance, or -1 if none left.
  let remaining;
  try {
    const { data, error } = await admin.rpc("spend_one_credit", { p_user_id: user.id });
    if (error) throw error;
    remaining = data;
  } catch (err) {
    console.error("spend_one_credit error:", err);
    return res.status(500).json({ error: "Could not check your credits." });
  }
  if (remaining === -1) {
    return res.status(402).json({ error: "You're out of credits. Buy more to run another survey." });
  }

  const userMsg = `Location: ${place}

Assess this place against these six flourishing dimensions:
${DOMAINS.map((d) => `- ${d.key} (${d.label}): ideal = ${d.ideal}. Look for: ${d.indicators}.`).join("\n")}

Search the web for real, location-specific data. Return the JSON object as instructed.`;

  try {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      console.error("Anthropic API error:", apiRes.status, detail);
      await refund(admin, user.id);
      return res.status(502).json({ error: "The analysis service returned an error. Your credit was refunded." });
    }

    const data = await apiRes.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      await refund(admin, user.id);
      return res.status(502).json({ error: "Could not read a result. Your credit was refunded." });
    }

    const parsed = JSON.parse(text.slice(start, end + 1));
    parsed._creditsRemaining = remaining; // let the UI update the balance
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("analyze error:", err);
    await refund(admin, user.id);
    return res.status(500).json({ error: "Something went wrong. Your credit was refunded." });
  }
}
