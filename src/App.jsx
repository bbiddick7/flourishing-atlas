import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabaseClient.js";
import { TERMS, REFUND, LEGAL_LAST_UPDATED } from "./lib/legal.js";

const DOMAINS = [
  { key: "happiness", label: "Happiness & Life Satisfaction", ideal: "People broadly report contentment with their lives; daily life affords moments of ease, not just survival." },
  { key: "health", label: "Physical & Mental Health", ideal: "Healthspan tracks lifespan; care is accessible; mental health support exists without stigma." },
  { key: "meaning", label: "Meaning & Purpose", ideal: "People of all ages have roles that matter; work, service, and contribution are available across the whole lifespan." },
  { key: "character", label: "Character & Virtue", ideal: "Institutions are trustworthy; people act with integrity toward one another; corruption is low." },
  { key: "relationships", label: "Close Social Relationships", ideal: "Few are isolated; intergenerational connection is designed into community life, not left to chance." },
  { key: "structure", label: "Societal Structure (New Map of Life)", ideal: "The rigid learn–work–retire model is loosened: education, work, and leisure are redistributed across a long life; cities are age-forward." },
];

const TIER_STYLE = {
  measured: { label: "Data found", color: "var(--found)" },
  partial: { label: "Partial / proxy data", color: "var(--partial)" },
  none: { label: "No local data found", color: "var(--none)" },
};

const PACKS = [
  { id: "small", credits: 5, label: "5 surveys" },
  { id: "medium", credits: 15, label: "15 surveys" },
  { id: "large", credits: 50, label: "50 surveys" },
];

export default function FlourishingAtlas() {
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authSent, setAuthSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);       // must accept terms before sign-in
  const [legalPage, setLegalPage] = useState(null);   // null | "terms" | "refund"

  const [credits, setCredits] = useState(null);
  const [buying, setBuying] = useState(false);

  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState("");
  const inputRef = useRef(null);

  // ── Auth wiring ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const token = session?.access_token;

  const refreshBalance = useCallback(async () => {
    if (!token) { setCredits(null); return; }
    try {
      const r = await fetch("/api/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });
      const d = await r.json();
      if (r.ok) setCredits(d.credits);
    } catch { /* leave as-is */ }
  }, [token]);

  useEffect(() => { refreshBalance(); }, [refreshBalance]);

  // If returning from a successful Stripe checkout, poll balance a few times
  // since the webhook may land a moment after redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "success" && token) {
      let tries = 0;
      const iv = setInterval(() => {
        refreshBalance();
        if (++tries >= 5) clearInterval(iv);
      }, 1500);
      window.history.replaceState({}, "", window.location.pathname);
      return () => clearInterval(iv);
    }
  }, [token, refreshBalance]);

  async function sendMagicLink() {
    const email = authEmail.trim();
    if (!email) return;
    if (!agreed) {
      setError("Please agree to the Terms of Service and Refund Policy first.");
      return;
    }
    setAuthBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setAuthSent(true);
    } catch (err) {
      setError(err.message || "Could not send the sign-in link.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setCredits(null);
    setResult(null);
    setStatus("idle");
  }

  async function buy(packId) {
    if (!token) return;
    setBuying(true);
    setError("");
    try {
      const r = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: packId, accessToken: token }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Checkout failed.");
      window.location.href = d.url; // off to Stripe
    } catch (err) {
      setError(err.message || "Could not start checkout.");
      setBuying(false);
    }
  }

  async function analyze(place) {
    setStatus("running");
    setError("");
    setResult(null);
    setSubmitted(place);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: place, accessToken: token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      if (typeof data._creditsRemaining === "number") setCredits(data._creditsRemaining);
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setStatus("error");
      refreshBalance();
    }
  }

  function handleSubmit() {
    const place = location.trim();
    if (!place) { inputRef.current?.focus(); return; }
    if (!credits || credits < 1) {
      setError("You're out of credits. Buy a pack below to run a survey.");
      setStatus("error");
      return;
    }
    analyze(place);
  }

  const measuredCount = result?.domains?.filter((d) => d.tier === "measured").length ?? 0;

  return (
    <div className="atlas">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Spline+Sans+Mono:wght@400;500&family=Spline+Sans:wght@400;500;600&display=swap');
        .atlas {
          --ink:#1c2321; --paper:#f3efe4; --paper-deep:#e9e3d2; --line:#c4bca4;
          --accent:#1f5c4a; --accent-soft:#2f6f5b; --copper:#b3673b;
          --found:#1f5c4a; --partial:#b3673b; --none:#8c8472; --muted:#5d5847;
          background:var(--paper); color:var(--ink);
          font-family:'Spline Sans',system-ui,sans-serif; min-height:100vh; line-height:1.55;
        }
        .atlas *{box-sizing:border-box;}
        .wrap{max-width:760px; margin:0 auto; padding:32px 24px 80px;}
        .topbar{display:flex; justify-content:flex-end; align-items:center; gap:14px; font-family:'Spline Sans Mono',monospace; font-size:12px; color:var(--muted); min-height:24px;}
        .topbar .credits{color:var(--ink);}
        .topbar .credits b{color:var(--accent);}
        .linkbtn{background:none; border:none; color:var(--accent); cursor:pointer; font:inherit; text-decoration:underline; padding:0;}
        .mast{border-bottom:2px solid var(--ink); padding-bottom:18px; margin:8px 0 6px;}
        .eyebrow{font-family:'Spline Sans Mono',monospace; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:var(--accent); margin:0 0 12px;}
        .title{font-family:'Fraunces',serif; font-weight:500; font-size:clamp(34px,7vw,54px); line-height:.98; margin:0; letter-spacing:-.01em;}
        .title em{font-style:italic; color:var(--accent);}
        .sub{font-size:14.5px; color:var(--muted); margin:14px 0 0; max-width:52ch;}
        .coord{font-family:'Spline Sans Mono',monospace; font-size:10.5px; color:var(--line); letter-spacing:.15em; margin-top:14px;}
        .panel{margin-top:26px; background:var(--paper-deep); border:1px solid var(--line); padding:22px;}
        .panel-label{font-family:'Spline Sans Mono',monospace; font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); margin:0 0 12px; display:block;}
        .searchrow{display:flex; gap:10px; flex-wrap:wrap;}
        .field{flex:1 1 220px; min-width:0; background:var(--paper); border:1px solid var(--ink); padding:13px 14px; font-size:16px; color:var(--ink); font-family:inherit; border-radius:0;}
        .field:focus{outline:2px solid var(--accent); outline-offset:1px;}
        .field::placeholder{color:#9b937f;}
        .go{background:var(--accent); color:var(--paper); border:none; padding:13px 24px; font-size:15px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .15s;}
        .go:hover:not(:disabled){background:var(--accent-soft);}
        .go:disabled{opacity:.55; cursor:not-allowed;}
        .go:focus-visible{outline:2px solid var(--ink); outline-offset:2px;}
        .disclaimer{font-size:12.5px; color:var(--muted); margin:14px 0 0; line-height:1.5;}
        .hint{font-size:13px; color:var(--copper); margin:12px 0 0;}
        .packs{display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;}
        .pack{flex:1 1 120px; background:var(--paper); border:1px solid var(--ink); padding:14px; cursor:pointer; font-family:inherit; text-align:left; transition:background .12s;}
        .pack:hover:not(:disabled){background:#fff;}
        .pack:disabled{opacity:.55; cursor:progress;}
        .pack .n{font-family:'Fraunces',serif; font-size:22px; display:block;}
        .pack .l{font-size:12px; color:var(--muted); font-family:'Spline Sans Mono',monospace;}
        .running{margin-top:28px; font-family:'Spline Sans Mono',monospace; font-size:13px; color:var(--accent); display:flex; align-items:center; gap:10px;}
        .pulse{width:9px; height:9px; background:var(--accent); border-radius:50%; animation:pulse 1.1s ease-in-out infinite;}
        @keyframes pulse{0%,100%{opacity:.25; transform:scale(.8);} 50%{opacity:1; transform:scale(1.15);}}
        .errbox{margin-top:24px; border:1px solid var(--copper); border-left-width:4px; background:#f6ece4; padding:16px 18px;}
        .errbox h3{margin:0 0 6px; font-size:14px; color:var(--copper); font-family:'Spline Sans Mono',monospace; letter-spacing:.04em;}
        .errbox p{margin:0; font-size:14px; color:var(--ink);}
        .resulthead{margin-top:38px; padding-bottom:16px; border-bottom:1px solid var(--line);}
        .place-name{font-family:'Fraunces',serif; font-size:28px; font-weight:500; margin:0;}
        .place-note{font-size:14px; color:var(--muted); margin:6px 0 0;}
        .coverage{font-family:'Spline Sans Mono',monospace; font-size:11px; color:var(--muted); margin-top:14px; letter-spacing:.05em;}
        .coverage strong{color:var(--ink);}
        .legend{display:flex; gap:18px; flex-wrap:wrap; margin-top:12px;}
        .legitem{display:flex; align-items:center; gap:6px; font-size:11.5px; font-family:'Spline Sans Mono',monospace; color:var(--muted);}
        .dot{width:10px; height:10px; border-radius:50%;}
        .domain{border-bottom:1px solid var(--line); padding:26px 0;}
        .domain:last-child{border-bottom:none;}
        .d-head{display:flex; align-items:baseline; gap:12px; flex-wrap:wrap;}
        .d-num{font-family:'Spline Sans Mono',monospace; font-size:12px; color:var(--line);}
        .d-label{font-family:'Fraunces',serif; font-size:21px; font-weight:500; margin:0; flex:1 1 auto;}
        .tier-tag{font-family:'Spline Sans Mono',monospace; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; padding:3px 9px; border:1px solid currentColor; white-space:nowrap;}
        .ideal{font-size:13px; color:var(--muted); font-style:italic; margin:12px 0 0; padding-left:14px; border-left:2px solid var(--line);}
        .finding{font-size:15px; margin:14px 0 0;}
        .evidence{font-family:'Spline Sans Mono',monospace; font-size:11.5px; color:var(--muted); margin:8px 0 0;}
        .actions{margin:16px 0 0; padding:0; list-style:none;}
        .actions li{position:relative; padding-left:22px; font-size:14.5px; margin-bottom:9px;}
        .actions li::before{content:"→"; position:absolute; left:0; top:0; color:var(--accent); font-weight:600;}
        .act-label{font-family:'Spline Sans Mono',monospace; font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin:16px 0 8px;}
        .footnote{margin-top:44px; padding-top:18px; border-top:1px solid var(--line); font-size:12px; color:var(--muted); line-height:1.6;}
        .footnote strong{color:var(--ink);}
        .authcard{margin-top:26px; background:var(--paper-deep); border:1px solid var(--line); padding:22px;}
        .agree{display:flex; align-items:flex-start; gap:9px; margin-top:14px; font-size:13px; color:var(--muted); cursor:pointer; line-height:1.5;}
        .agree input{margin-top:3px; flex:0 0 auto; cursor:pointer;}
        .inline-link{background:none; border:none; padding:0; color:var(--accent); font:inherit; text-decoration:underline; cursor:pointer;}
        .inline-link:hover{color:var(--accent-soft);}
        .site-footer{margin-top:56px; padding-top:20px; border-top:1px solid var(--line); display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:center; font-family:'Spline Sans Mono',monospace; font-size:11.5px; color:var(--muted);}
        .footer-links{display:flex; gap:16px;}
        .legal-overlay{position:fixed; inset:0; background:rgba(28,35,33,0.55); display:flex; align-items:flex-start; justify-content:center; padding:40px 20px; overflow-y:auto; z-index:50;}
        .legal-modal{background:var(--paper); border:1px solid var(--ink); max-width:680px; width:100%; padding:36px 40px; position:relative; box-shadow:0 12px 48px rgba(0,0,0,0.25);}
        .legal-close{position:absolute; top:14px; right:18px; background:none; border:none; font-size:28px; line-height:1; color:var(--muted); cursor:pointer;}
        .legal-close:hover{color:var(--ink);}
        .legal-title{font-family:'Fraunces',serif; font-size:28px; font-weight:500; margin:0 0 4px;}
        .legal-updated{font-family:'Spline Sans Mono',monospace; font-size:11px; color:var(--muted); margin:0 0 20px;}
        .legal-section{margin-bottom:18px;}
        .legal-section h3{font-family:'Fraunces',serif; font-size:16px; font-weight:600; margin:0 0 6px;}
        .legal-section p{font-size:14px; margin:0; color:var(--ink); line-height:1.6;}
        @media (prefers-reduced-motion:reduce){.pulse{animation:none;}}
      `}</style>

      <div className="wrap">
        <div className="topbar">
          {session ? (
            <>
              {credits !== null && <span className="credits">Balance: <b>{credits}</b> {credits === 1 ? "survey" : "surveys"}</span>}
              <span>{session.user.email}</span>
              <button className="linkbtn" onClick={signOut}>Sign out</button>
            </>
          ) : <span>Not signed in</span>}
        </div>

        <header className="mast">
          <p className="eyebrow">A flourishing survey instrument</p>
          <h1 className="title">The Flourishing <em>Atlas</em></h1>
          <p className="sub">
            Enter a place. This tool searches the open web for real local data and charts what it
            finds against six dimensions of a flourishing community — then suggests action steps for
            the gaps. Where data doesn't exist, it says so rather than guessing.
          </p>
          <p className="coord">FRAMEWORK · GLOBAL FLOURISHING STUDY × STANFORD NEW MAP OF LIFE</p>
        </header>

        {!session ? (
          <section className="authcard">
            <label className="panel-label" htmlFor="email">Sign in to begin</label>
            {authSent ? (
              <p style={{ margin: 0, fontSize: "14.5px" }}>
                Check your inbox — we sent a sign-in link to <strong>{authEmail.trim()}</strong>.
                Open it on this device to continue.
              </p>
            ) : (
              <>
                <div className="searchrow">
                  <input id="email" className="field" type="email" placeholder="you@example.com"
                    value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMagicLink()} disabled={authBusy} />
                  <button className="go" onClick={sendMagicLink} disabled={authBusy}>
                    {authBusy ? "Sending…" : "Email me a link"}
                  </button>
                </div>
                <p className="disclaimer">No password. We email you a one-time link to sign in. Your email is used only to hold your survey credits.</p>
                <label className="agree">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>
                    I agree to the{" "}
                    <button type="button" className="inline-link" onClick={() => setLegalPage("terms")}>Terms of Service</button>
                    {" "}and{" "}
                    <button type="button" className="inline-link" onClick={() => setLegalPage("refund")}>Refund Policy</button>.
                  </span>
                </label>
              </>
            )}
            {error && <p className="hint">{error}</p>}
          </section>
        ) : (
          <>
            <section className="panel">
              <label className="panel-label" htmlFor="loc">Survey a location</label>
              <div className="searchrow">
                <input id="loc" ref={inputRef} className="field" type="text"
                  placeholder="e.g. Madison, Wisconsin" value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  disabled={status === "running"} />
                <button className="go" onClick={handleSubmit} disabled={status === "running" || !credits}>
                  {status === "running" ? "Surveying…" : "Run survey (1 credit)"}
                </button>
              </div>
              <p className="disclaimer">
                Results depend on what's publicly searchable for the place you enter. Larger cities
                surface more data than small towns. Verify any figure against its primary source
                before citing it — this is a starting map, not a finished census.
              </p>
              {(credits === 0 || credits === null) && (
                <p className="hint">You have no credits yet. Choose a pack below.</p>
              )}
            </section>

            <section className="panel">
              <label className="panel-label">Buy survey credits</label>
              <div className="packs">
                {PACKS.map((p) => (
                  <button key={p.id} className="pack" onClick={() => buy(p.id)} disabled={buying}>
                    <span className="n">{p.credits}</span>
                    <span className="l">{p.label}</span>
                  </button>
                ))}
              </div>
              <p className="disclaimer">
                Secure checkout via Stripe. Prices are set in checkout. Credits are added to your
                balance once payment completes.
              </p>
            </section>
          </>
        )}

        {status === "running" && (
          <div className="running"><span className="pulse" />Searching public data for {submitted}…</div>
        )}

        {status === "error" && (
          <div className="errbox">
            <h3>Survey didn't complete</h3>
            <p>{error}</p>
          </div>
        )}

        {status === "done" && result && (
          <div className="results">
            <div className="resulthead">
              <h2 className="place-name">{result.place || submitted}</h2>
              {result.placeNote && <p className="place-note">{result.placeNote}</p>}
              <p className="coverage">Local data found for <strong>{measuredCount}</strong> of 6 dimensions.</p>
              <div className="legend">
                <span className="legitem"><span className="dot" style={{ background: "var(--found)" }} />Data found</span>
                <span className="legitem"><span className="dot" style={{ background: "var(--partial)" }} />Partial / proxy</span>
                <span className="legitem"><span className="dot" style={{ background: "var(--none)" }} />No local data</span>
              </div>
            </div>
            {DOMAINS.map((domain, i) => {
              const found = result.domains?.find((d) => d.key === domain.key);
              const tier = found?.tier && TIER_STYLE[found.tier] ? found.tier : "none";
              const ts = TIER_STYLE[tier];
              return (
                <article className="domain" key={domain.key}>
                  <div className="d-head">
                    <span className="d-num">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="d-label">{domain.label}</h3>
                    <span className="tier-tag" style={{ color: ts.color }}>{ts.label}</span>
                  </div>
                  <p className="ideal">Ideal — {domain.ideal}</p>
                  {found?.finding && <p className="finding">{found.finding}</p>}
                  {found?.evidence && <p className="evidence">Source signal: {found.evidence}</p>}
                  {found?.actions?.length > 0 && (
                    <>
                      <p className="act-label">What you can do here</p>
                      <ul className="actions">{found.actions.map((a, j) => <li key={j}>{a}</li>)}</ul>
                    </>
                  )}
                </article>
              );
            })}
            <p className="footnote">
              <strong>How to read this.</strong> The "ideal" lines are normative reference points
              from the flourishing frameworks, not measured benchmarks. "Data found" means search
              returned concrete local figures; "partial" means proxy or regional signals only; "no
              local data" means nothing place-specific surfaced — a real and common result for
              smaller communities, and itself a finding worth noting. Treat action steps as prompts
              for local conversation, not prescriptions.
            </p>
          </div>
        )}

        <footer className="site-footer">
          <span>© {new Date().getFullYear()} North Bridge Solutions · Madison, Wisconsin</span>
          <span className="footer-links">
            <button type="button" className="inline-link" onClick={() => setLegalPage("terms")}>Terms of Service</button>
            <button type="button" className="inline-link" onClick={() => setLegalPage("refund")}>Refund Policy</button>
          </span>
        </footer>
      </div>

      {legalPage && (
        <div className="legal-overlay" onClick={() => setLegalPage(null)}>
          <div className="legal-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="legal-close" onClick={() => setLegalPage(null)} aria-label="Close">×</button>
            {(() => {
              const doc = legalPage === "terms" ? TERMS : REFUND;
              return (
                <>
                  <h2 className="legal-title">{doc.title}</h2>
                  <p className="legal-updated">Last updated: {LEGAL_LAST_UPDATED}</p>
                  {doc.sections.map((s, i) => (
                    <div key={i} className="legal-section">
                      <h3>{s.heading}</h3>
                      <p>{s.body}</p>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
