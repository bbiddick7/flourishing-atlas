// ─────────────────────────────────────────────────────────────────────────
// LEGAL CONTENT — swap this text after your attorney's review.
// Keeping it isolated here means you can paste in final wording without
// touching any app logic. Each section is plain JSX; edit the strings freely.
//
// PLACEHOLDERS still to fill in: contact email, county, dates, refund window.
// ─────────────────────────────────────────────────────────────────────────

export const LEGAL_LAST_UPDATED = "June 10, 2026";
export const CONTACT_EMAIL = "contact@northbridgesp.com";

export const TERMS = {
  title: "Terms of Service",
  sections: [
    {
      heading: "1. Who we are",
      body: "The Flourishing Atlas (\u201Cthe Service\u201D) is operated by North Bridge Solutions (\u201Cwe,\u201D \u201Cus,\u201D \u201Cour\u201D), located in Madison, Wisconsin. By creating an account, purchasing credits, or running a survey, you agree to these Terms of Service.",
    },
    {
      heading: "2. What the Service does",
      body: "The Flourishing Atlas lets you enter a location and generates an analysis comparing that community against six dimensions of human flourishing, drawing on publicly searchable web data. The analysis is produced with the assistance of artificial intelligence and automated web search.",
    },
    {
      heading: "3. The nature of the output \u2014 please read carefully",
      body: "The Service produces informational analysis for general interest and discussion, not professional, financial, legal, medical, or policy advice. Output depends on what is publicly searchable for a given location and varies widely; for some locations little or no specific data will be found, and the Service will say so. AI-generated and search-derived content may contain errors, omissions, or out-of-date information. We do not warrant that any figure, source, or statement is accurate, complete, or current. You are responsible for independently verifying any information before relying on or republishing it.",
    },
    {
      heading: "4. Accounts",
      body: "You sign in using a one-time email link. You are responsible for keeping access to your email account secure, must provide a valid email address, and may not use the Service on behalf of someone else without authorization.",
    },
    {
      heading: "5. Credits and payment",
      body: "Running a survey costs one credit. Credits are purchased in packs through our payment processor, Stripe. Prices are shown at checkout and may change, but changes do not affect credits already purchased. Credits have no cash value, are not transferable, and \u2014 except as described in our Refund Policy \u2014 are non-refundable once used. If a survey fails for a technical reason on our side, the credit is automatically returned to your balance.",
    },
    {
      heading: "6. Acceptable use",
      body: "You agree not to use the Service for any unlawful purpose; to generate analysis about individuals in a way that harasses, surveils, or harms them; to disrupt, overload, reverse-engineer, or gain unauthorized access to the Service; to resell or commercially exploit the output without written permission; or to use automated means to abuse the credit system. We may suspend or terminate access for violations.",
    },
    {
      heading: "7. Intellectual property",
      body: "The Service\u2019s design, code, and framework are owned by North Bridge Solutions. Survey output is provided for your own use, subject to the verification responsibilities above. Underlying data sources surfaced by the Service remain the property of their respective owners.",
    },
    {
      heading: "8. Disclaimers and limitation of liability",
      body: "The Service is provided \u201Cas is\u201D and \u201Cas available,\u201D without warranties of any kind. To the maximum extent permitted by law, North Bridge Solutions is not liable for any indirect, incidental, or consequential damages arising from your use of the Service or reliance on its output. Where liability cannot be excluded, our total liability is limited to the amount you paid us in the 90 days before the claim arose.",
    },
    {
      heading: "9. Changes to these terms",
      body: "We may update these Terms. Material changes are reflected by updating the \u201CLast updated\u201D date. Continued use after changes means you accept them.",
    },
    {
      heading: "10. Governing law",
      body: "These Terms are governed by the laws of the State of Wisconsin. Any dispute will be handled in the state or federal courts located in Iowa County, Wisconsin.",
    },
    {
      heading: "11. Contact",
      body: `Questions about these Terms: ${CONTACT_EMAIL}`,
    },
  ],
};

export const REFUND = {
  title: "Refund Policy",
  sections: [
    {
      heading: "Automatic credit return for failed surveys",
      body: "If a survey does not complete because of a technical error on our side, the credit is automatically returned to your balance. You are never charged a credit for a survey that fails to produce a result.",
    },
    {
      heading: "Unused credits",
      body: `If you purchased a credit pack and have not used any of the credits, you may request a refund of that purchase within 14 days by emailing ${CONTACT_EMAIL}. We will refund the full purchase price for wholly unused packs. Payment-processing fees charged by Stripe may not be recoverable, and your refund may be reduced by those fees.`,
    },
    {
      heading: "Used credits",
      body: "Credits used to run a completed survey are non-refundable, because the cost of producing the survey (AI processing and web search) has already been incurred. A survey that returns honest \u201Cno local data found\u201D results has run successfully and is not grounds for a refund.",
    },
    {
      heading: "Disputed or unauthorized charges",
      body: `If you believe a charge was made in error or without authorization, contact us at ${CONTACT_EMAIL} before initiating a chargeback, and we will work to resolve it promptly.`,
    },
    {
      heading: "How to request a refund",
      body: `Email ${CONTACT_EMAIL} with the email address on your account and the approximate date of purchase. We aim to respond within 5 business days.`,
    },
  ],
};
