// Jev classification + ICP qualification. Usage: npm run classify [-- --sample 10]
import { TypeSafeClient, choice, noul } from "@typesafe-ai/sdk";
import { supabase, FREEMAIL, flag } from "./lib.js";

// ── Qualification rule — Uday owns these values (approved in plan) ──────────
const ICP_TYPES = new Set(["marketing_gtm_agency", "leadgen_outbound_shop", "b2b_saas_sales_martech"]);
const MIN_TYPE_PROB = 0.6;
const MIN_LEGIT = 0.5; // pre-enrichment gate; GetLeads enrichment is the second filter
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE = Number(flag("sample") ?? Infinity);
const client = new TypeSafeClient();

const SEGMENT = {
  agency_service_pitch: "An agency pitching its services to me (marketing, growth, SEO, design, dev, GTM consulting)",
  cold_saas_sales: "A software company selling access to its SaaS product",
  lead_gen_offer: "Selling lead generation, appointment setting, cold-email campaigns, or contact/data lists",
  recruiting: "Recruiting, staffing, or a job/candidate opportunity",
  newsletter_blast: "Newsletter, content promo, webinar/event invite, or bulk marketing not directly selling to me",
  scam_phishing: "Scam, phishing, crypto/advance-fee fraud, or deceptive impersonation",
  other: "None of the above",
};

const BUSINESS_TYPE = {
  marketing_gtm_agency: "A marketing, growth, demand-gen, brand, or GTM agency that provides services to clients",
  leadgen_outbound_shop: "A cold-email agency, appointment-setting shop, SDR-as-a-service, or lead-gen/list provider",
  b2b_saas_sales_martech: "A B2B software company in sales tech, martech, outreach tooling, or data/enrichment",
  recruiter_staffing: "A recruiting or staffing firm",
  other: "Any other kind of sender (or not determinable)",
};

async function classifyOne(e: { from_name: string; from_email: string; from_domain: string; subject: string; body_text: string }) {
  const res = await client.systemOne({
    state: {
      from_name: e.from_name,
      from_email: e.from_email,
      from_domain: e.from_domain,
      subject: e.subject,
      body: (e.body_text ?? "").slice(0, 4000),
    },
    questions: {
      segment: choice("What kind of outreach is this email? Judge from `subject` and `body`.", SEGMENT),
      business_type: choice(
        "What kind of business is the sender (the company behind `from_email` at `from_domain`)?",
        BUSINESS_TYPE,
      ),
      legit: noul(
        "The sender is a genuine operating business doing cold outreach — not a scam, phishing attempt, or spoofed identity.",
      ),
    },
  });
  const a: any = res.answers;
  return {
    segment: a.segment.choice,
    segment_probs: a.segment.probabilities,
    segment_confidence: a.segment.confidence,
    business_type: a.business_type.choice,
    business_type_probs: a.business_type.probabilities,
    business_type_confidence: a.business_type.confidence,
    legit: a.legit.noul,
  };
}

// 1. Classify unclassified emails
const { data: pending, error } = await supabase
  .from("emails")
  .select("gmail_id, from_name, from_email, from_domain, subject, body_text")
  .is("classification", null)
  .order("received_at", { ascending: false })
  .limit(Number.isFinite(SAMPLE) ? SAMPLE : 10000);
if (error) throw error;
console.log(`Classifying ${pending.length} emails`);

const CONCURRENCY = 4;
for (let i = 0; i < pending.length; i += CONCURRENCY) {
  await Promise.all(
    pending.slice(i, i + CONCURRENCY).map(async (e) => {
      const c = await classifyOne(e as any);
      const { error } = await supabase.from("emails").update({ classification: c }).eq("gmail_id", e.gmail_id);
      if (error) throw error;
      console.log(
        `  ${e.from_domain}: segment=${c.segment} type=${c.business_type} (p=${(c.business_type_probs[c.business_type] ?? 0).toFixed(2)}) legit=${c.legit.toFixed(2)}`,
      );
    }),
  );
}

// 2. Roll up to senders (one row per non-freemail domain, best evidence email)
const { data: classified, error: cErr } = await supabase
  .from("emails")
  .select("gmail_id, from_domain, received_at, classification")
  .not("classification", "is", null);
if (cErr) throw cErr;

const byDomain = new Map<string, typeof classified>();
for (const e of classified) {
  if (!e.from_domain || FREEMAIL.has(e.from_domain)) continue;
  (byDomain.get(e.from_domain) ?? byDomain.set(e.from_domain, []).get(e.from_domain)!).push(e);
}

let qualifiedCount = 0;
for (const [domain, emails] of byDomain) {
  const best = emails.reduce((a, b) => {
    const la = a.classification.legit ?? 0;
    const lb = b.classification.legit ?? 0;
    return lb > la || (lb === la && (b.received_at ?? "") > (a.received_at ?? "")) ? b : a;
  });
  const c = best.classification;
  const typeProb = c.business_type_probs?.[c.business_type] ?? 0;
  const qualified = ICP_TYPES.has(c.business_type) && typeProb >= MIN_TYPE_PROB && c.legit >= MIN_LEGIT;
  if (qualified) qualifiedCount++;
  const { error } = await supabase.from("senders").upsert({
    domain,
    segment: c.segment,
    business_type: c.business_type,
    business_type_prob: typeProb,
    legit_prob: c.legit,
    qualified,
    evidence_gmail_id: best.gmail_id,
    email_count: emails.length,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
console.log(`Senders: ${byDomain.size} domains, ${qualifiedCount} qualified`);
