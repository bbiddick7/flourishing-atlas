# The Flourishing Atlas — paid edition

A public web tool that surveys any location against six dimensions of human
flourishing (five from the **Global Flourishing Study**, one structural dimension
from **Stanford's New Map of Life**), using live web search for real local data.
Users sign in with a one-time email link, buy survey credits via Stripe, and
spend one credit per survey.

## What's in here

```
api/analyze.js          run a survey — requires sign-in + spends 1 credit
api/balance.js          read the signed-in user's credit balance
api/create-checkout.js  start a Stripe Checkout for a credit pack
api/stripe-webhook.js   grant credits after verified payment (signature-checked)
api/_lib/supabaseAdmin.js  server-side Supabase (service-role) helper
src/App.jsx             the UI: auth, balance, buy flow, survey, results
src/lib/supabaseClient.js  browser Supabase (anon) client
supabase/schema.sql     database tables, RLS, atomic spend/grant functions
.env.example            every variable, and where each one belongs
```

## The trust model, in one paragraph

The browser never holds any secret. It gets the **anon** Supabase key (public by
design) and a per-user **access token** from sign-in. Every action that touches
money or credits goes to a serverless function, which verifies the token to learn
who's calling, then uses the **service-role** key (server-only) to read or write.
Credits are granted in exactly one place — the Stripe webhook — and only after
Stripe's cryptographic signature is verified, so no one can forge a "payment
succeeded" call. Spending a credit is a single atomic database operation, so two
simultaneous requests can't both spend the last credit.

---

## Setup (the honest, do-this-in-order version)

> These steps reflect the Supabase, Stripe, and Vercel dashboards as of early
> 2026. All three change their UIs regularly. If a screen doesn't match, trust
> the provider's current docs over this README.

### 1. Supabase
1. Create a project at supabase.com.
2. In the SQL editor, paste and run `supabase/schema.sql`.
3. Under **Authentication → Providers**, make sure Email is enabled with magic
   links. Add your deployed site URL (and `http://localhost:5173` for local) to
   the allowed redirect URLs.
4. From **Project Settings → API**, collect: the project URL, the **anon**
   public key, and the **service_role** secret key.

### 2. Stripe
1. In the Stripe dashboard, create three **Products**, each with a one-time
   **Price** (your choice of amount). Copy each price ID (`price_...`).
2. Collect your **Secret key** (`sk_...`). Use test keys until you're ready.
3. The **webhook secret** comes after deploy — see step 4.

### 3. Deploy to Vercel
1. Push this repo to GitHub, import it in Vercel (framework preset: Vite).
2. Add environment variables (Settings → Environment Variables). See the table
   below. The `VITE_` ones are browser-exposed and must only be the public
   Supabase URL + anon key. Everything else is server-only.
3. Deploy to get your `*.vercel.app` URL.

### 4. Connect the Stripe webhook (do this after first deploy)
1. In Stripe → Developers → **Webhooks**, add an endpoint pointing at
   `https://YOUR-SITE/api/stripe-webhook`, subscribed to
   `checkout.session.completed`.
2. Copy the endpoint's **signing secret** (`whsec_...`).
3. Add it to Vercel as `STRIPE_WEBHOOK_SECRET` and redeploy.

### Environment variables

| Name | Where it goes | Secret? |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel (browser) | public |
| `VITE_SUPABASE_ANON_KEY` | Vercel (browser) | public |
| `ANTHROPIC_API_KEY` | Vercel (server) | **secret** |
| `SUPABASE_URL` | Vercel (server) | public-ish |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server) | **secret** |
| `STRIPE_SECRET_KEY` | Vercel (server) | **secret** |
| `STRIPE_WEBHOOK_SECRET` | Vercel (server) | **secret** |
| `STRIPE_PRICE_SMALL/MEDIUM/LARGE` | Vercel (server) | config |

---

## Things I cannot do for you, and you must own

**The legal and tax layer is real and is not handled by this code.** Taking
money from the public means you need terms of service, a refund policy, and
possibly sales-tax collection. Stripe Tax can compute tax, but *whether* you owe
it, and what your terms must say, is a question for an accountant or lawyer. I am
not one, and nothing here makes you compliant — it only makes the payments work
technically.

**Pricing must clear your cost.** Each survey costs you an Anthropic API call
plus web searches. I cannot give you a verified per-run figure — check current
Anthropic pricing and confirm a run's real cost, then set your Stripe prices so a
single credit comfortably exceeds that with margin. The credit *counts* (5/15/50)
are in two places if you change them: `api/create-checkout.js` (PACKS) and
`src/App.jsx` (PACKS) — keep them in sync, and keep them matched to the Stripe
prices you create.

**Refund-on-failure is best-effort.** If a survey errors after a credit is spent,
the code refunds the credit. That refund itself could fail (it's logged if so).
It is not a billing system of record — Stripe and your Supabase ledger are.

## Limitations carried over from the tool itself

- Data quality varies by place; small towns often return "no local data found"
  for several dimensions. That's a real result, surfaced honestly, not a bug.
- Search results aren't guaranteed accurate or current; the tool tells users to
  verify against primary sources.
- The "evidence" field is a lead to verify, not a citation to trust.
- The "ideal" descriptions are normative reference points, not measured scores.

## Local development

```bash
npm install
npm run dev            # front end only
# for the API + webhook locally, use: vercel dev  (with a .env.local)
```

To test the Stripe webhook locally, use the Stripe CLI's `stripe listen
--forward-to localhost:3000/api/stripe-webhook`, which gives you a local signing
secret.
