# Spam → Lead Gen Pipeline

Your spam folder is a lead list someone else paid to build.

Every cold email sitting in there is a sender with a **broken email infrastructure** — that's literally why it's in spam. If you sell anything to teams that do cold outbound, those senders are pre-qualified prospects who already told you (a) they do cold outbound and (b) it isn't landing. This pipeline mines them, scores them against your ICP, builds a real deliverability audit of their domain from DNS + their own email's headers, and drafts a reverse-pitch: *"your email to me landed in spam — here's exactly why, want the full audit?"*

```mermaid
flowchart LR
    G([Gmail<br/><sub>in:spam</sub>]) --> I["ingest<br/><sub>headers + body +<br/>Authentication-Results</sub>"]
    I --> C["classify + score<br/><sub>Jev · segment, business<br/>type, legitimacy</sub>"]
    C --> A["DNS audit<br/><sub>SPF · DMARC · MX<br/>zero LLM cost</sub>"]
    A --> E["enrich<br/><sub>email signatures first,<br/>paid vendors last</sub>"]
    E --> D([reverse-pitch<br/>drafts])

    I & C & A & E & D -.-> S[("Supabase<br/><sub>emails · senders · drafts</sub>")]
```

**Real first run:** 115 spam emails → 59 company domains → 19 ICP-qualified senders, each with a domain audit and a drafted pitch. Total LLM spend: about one cent.

## Quick start

You need Node 20.12+, a Gmail account, a free [Supabase](https://supabase.com) project, a [TypeSafe](https://typesafe.ai) API key, and [Claude Code](https://claude.com/claude-code) (or any coding agent) for the last two steps. Full setup is [below](#setup).

```bash
npm install && npm run auth          # Gmail OAuth, read-only
npm run ingest -- --max 25           # pull a test batch of spam
npm run classify -- --sample 10      # Jev classifies, ICP rule qualifies
npm run audit                        # DNS + header audit of qualified domains
```

Then, in Claude Code inside this folder: `/enrich-senders`, then `/draft-reverse-pitch`. Drafts land in your Supabase, nothing sends.

---

## How it works

### 1. Ingest — `npm run ingest`

Pulls everything matching `in:spam` via the Gmail API (read-only scope). For each email it stores the sender, subject, plain-text body, and the one header most people throw away: **`Authentication-Results`**.

That header is Gmail's own verdict on the sender's SPF, DKIM, and DMARC (the three DNS records receivers check to decide whether a sender is who it claims to be). Every prospect arrives carrying the evidence for their own audit.

Safe to re-run: already-ingested messages are skipped. Use `--max 25` for test batches.

### 2. Classify + qualify — `npm run classify`

Each email gets one batched request to [Jev](https://typesafe.ai) (TypeSafe's System One model — typed judgments, not generated text):

| Question | Primitive | Output |
|---|---|---|
| What kind of outreach is this? | Choice | `agency_service_pitch`, `cold_saas_sales`, `lead_gen_offer`, `recruiting`, `newsletter_blast`, `scam_phishing`, `other` + full probability distribution |
| What kind of business is the sender? | Choice | `marketing_gtm_agency`, `leadgen_outbound_shop`, `b2b_saas_sales_martech`, `recruiter_staffing`, `other` |
| Is this a genuine business, not a scam? | Noul (a yes/no probability) | a single number, 0 to 1 |

Emails roll up to one `senders` row per domain. Freemail domains like gmail.com are excluded, because you can't audit gmail.com.

A sender qualifies when its business type is in your ICP set with probability ≥ 0.6 **and** legitimacy ≥ 0.5. Both thresholds live at the top of `src/classify.ts`.

The legitimacy gate is deliberately loose. Enrichment acts as the second filter, and in practice scams scored 0.14–0.40 while real-but-spammy businesses scored 0.5+.

Why Jev instead of a frontier LLM? Classification here is a typed judgment, not prose. At $42 per **billion** input tokens, classifying an entire spam folder costs about a cent, roughly 200x less than the same job through a chat model.

### 3. Audit — `npm run audit`

The audit that powers the pitch is **pure DNS + the evidence already in hand**. Zero LLM cost:

- SPF record present and valid (TXT lookup)
- DMARC record and policy — `none` / `quarantine` / `reject` (`_dmarc.` TXT lookup)
- MX hosts → mailbox provider and any security gateway (suffix match against `src/gateway-map.json`)
- Their actual email's SPF/DKIM/DMARC verdicts, straight from the `Authentication-Results` header

Findings come out as pre-written copy fragments, e.g. *"Your DMARC policy is p=none — it monitors but doesn't protect, and mailbox providers score that accordingly."* When all auth passes but the mail still hit spam, that's a finding too — it means domain reputation, the harder half of deliverability.

### 4. Enrich — signatures first, vendors last

A lesson this repo paid 15 vendor lookups to learn: **cold-outbound sending domains are invisible to data vendors.** They're burner domains — `somethingflow.click`, `brandnamehub.com` — spun up weeks ago. Email→LinkedIn lookups returned 0 hits on 15 attempts.

The free path works better: the **email signature** usually names the real company and person, because the pitch has to be signed by someone. Extraction order:

1. Parse the real company/person out of the email body and signature (free)
2. Replying to the sender always works: they emailed you, and they monitor replies, that's the whole point of their campaign (free)
3. Paid decision-maker lookup only for confirmed real companies where a more senior contact beats answering the SDR (1–3 credits each)

### 5. Draft — the reverse-pitch

Drafts land in the `drafts` table (`draft` → `approved` → `sent`), written to a cold-email framework: under 90 words, give-first, one interest-based CTA, no links, sentence case like a person typing. Two example angles ship in the `draft-reverse-pitch` skill. **They are examples, not the pitch.** Write your own line about what you sell, or your own angle; the audit finding is the only part that has to stay factual.

**Angle A, the observation:**

> **Subject:** Acme Outbound + spam
>
> Jo, your note about appointment setting for SaaS teams reached me, in the spam folder.
>
> Took a look at why: Acme Outbound's sending domain has DMARC set to p=none, so Gmail scores it as unprotected. If it tripped my inbox, it is tripping most of the list.
>
> I run Northline, we build the outbound systems agencies run for their clients. Put together a short teardown of what is hurting your sends and the fix order.
>
> Want me to send it over?

**Angle B, the live demo:**

> **Subject:** Your email, reverse engineered
>
> Jo, your pitch landed in my spam folder. A pipeline I built pulled it out, read the headers, checked Acme Outbound's DNS, and wrote this reply. Cost: under a cent.
>
> The one thing it flagged: the email you sent on 24 Sep failed DKIM, which Gmail treats as a direct spam signal.
>
> That pipeline is the kind of thing Northline builds, we put AI systems behind GTM teams. Happy to share the full teardown of your domain.
>
> Want to see what else it found?

The hook writes itself because every claim is verifiable by the prospect in 30 seconds: it's their domain, their DNS, their email. The audit is the give that opens the door; the credibility line says what you actually sell.

---

## What you get

One Supabase row per qualified sender, carrying everything needed to pitch:

| Field | Example |
|---|---|
| `domain` | the sending domain |
| `business_type` / `segment` | `leadgen_outbound_shop` / `lead_gen_offer` |
| `legit_prob`, `business_type_prob` | raw Jev probabilities, reusable if you re-tune thresholds |
| `audit` | SPF/DMARC/MX facts + findings as ready-to-quote copy fragments |
| `enrichment.real_company` | the actual company behind the burner domain, from their signature |
| `evidence_gmail_id` | the email that proves the pitch |

Plus a `drafts` row with subject + body, waiting for review.

## What it costs

| Component | Per row |
|---|---|
| Gmail API, DNS audit, Supabase free tier | $0 |
| Jev classification (~2K input tokens) | ~$0.00008 |
| Signature enrichment + drafting | $0 marginal (runs in a Claude Code session) |
| Optional vendor enrichment | 1–3 credits, real companies only |

~**$0.0001 per email, end to end.** Run it daily forever and never notice the bill.

---

## Setup

You need Node 20.12+, a Gmail account, a free [Supabase](https://supabase.com) project, a [TypeSafe](https://typesafe.ai) API key, and Claude Code or another coding agent for the enrich and draft steps.

1. **Google OAuth** — In [Google Cloud Console](https://console.cloud.google.com): create a project, enable the **Gmail API**, create an **OAuth client ID → Desktop app** (not Web application — the JSON must have an `installed` key), add yourself as a test user on the consent screen, download the JSON as `credentials.json` into this folder. Then:
   ```bash
   npm install
   npm run auth   # opens browser, gmail.readonly scope only; token cached in token.json
   ```
2. **Supabase** — create a project, run `schema.sql` in the dashboard SQL editor (3 tables: `emails`, `senders`, `drafts`).
3. **Keys** — `cp .env.example .env`, fill in `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service_role), `TYPESAFE_API_KEY`.

## Running

```bash
npm run ingest -- --max 25       # test batch; omit --max for the full folder
npm run classify -- --sample 10  # sample first, sanity-check labels, then run full
npm run audit                    # DNS + auth-header audit of qualified domains
npm run audit -- --domain acme.com --force   # re-audit one domain
npm test                         # parse-layer unit checks
```

Enrichment and drafting are agent passes, not scripts: they read bodies, judge signatures, and write copy. Open the folder in Claude Code and run:

```bash
/enrich-senders          # real company + person from each email signature; vendor lookup optional
/draft-reverse-pitch     # 3 samples for your approval, then the batch, into the drafts table
```

Using a different agent? The same instructions are in `AGENTS.md`.

Before drafting, fill in the **Your pitch** block in `AGENTS.md` (your name, company, what you do, what you give), or put the same four lines in a gitignored `PITCH.local.md`. The agent reads and writes rows through `npm run rows`, so no database tool or MCP server is needed.

Tune who qualifies at the top of `src/classify.ts`: the ICP business types, `MIN_TYPE_PROB`, and `MIN_LEGIT`.

## Data & privacy

**No lead data lives in this repo.** Emails, classifications, audits, and drafts are rows in your own Supabase project. Secrets (`.env`, `credentials.json`, `token.json`) are gitignored; `.env.example` documents the required keys with placeholders. Gmail access is read-only.

## License

MIT — see [LICENSE](./LICENSE). Clone it, point it at your own spam folder, pitch your own service.
