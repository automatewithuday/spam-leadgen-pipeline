# Agent guide: Spam → Lead Gen Pipeline

Mines a Gmail spam folder for cold-outbound senders, qualifies them against an ICP with Jev
(typed classification, not a chat model), audits their sending domain from DNS plus the
`Authentication-Results` header of their own email, and drafts a reverse-pitch. Read
[README.md](README.md) for the why; this file is the how for agents.

## Pipeline order

| Step | Command | Who runs it |
|---|---|---|
| 1. Ingest spam | `npm run ingest -- --max 25` (omit `--max` for all) | script |
| 2. Classify + qualify | `npm run classify -- --sample 10`, review, then full run | script |
| 3. DNS audit | `npm run audit` | script |
| 4. Enrich | skill `enrich-senders` | agent |
| 5. Draft | skill `draft-reverse-pitch` | agent |

Steps 4 and 5 are agent passes over Supabase rows. Use `npm run rows` for all reads and
writes (see [src/rows.ts](src/rows.ts)); never require a database tool or MCP server.

## Operator-owned values: propose, never silently change

- ICP set and thresholds at the top of [src/classify.ts](src/classify.ts):
  `ICP_TYPES`, `MIN_TYPE_PROB`, `MIN_LEGIT`.
- The pitch block below (who the operator is, what the give is).
- Which drafts get approved. Drafts land with `status = 'draft'`; nothing sends email.

If a value looks wrong, say so with evidence and wait for a decision.

## Your pitch (operator fills in before drafting)

```
YOUR_NAME:        
YOUR_COMPANY:     
WHAT_YOU_DO:      one plain sentence, in the prospect's words, e.g. "we run outbound for b2b agencies"
THE_GIVE:         what you hand over on a yes, e.g. "a short teardown of what is tripping their sends and the fix order"
```

The deliverability audit is the give that opens the door. It is only the product if that is
genuinely what you sell. Do not let the credibility line claim deliverability as the business
unless `WHAT_YOU_DO` says so.

## Rules

- Secrets live in `.env`, `credentials.json`, `token.json` only. Never print, log, or commit them.
- No lead data in the repo. Emails, classifications, audits, and drafts are rows in the operator's Supabase.
- Classification stays on Jev. Do not route bulk classification through a chat model; it costs about 200x more.
- Paid enrichment is optional and last. Signature extraction is free and works better on burner domains.
- Report plainly: failed runs, skipped steps, thin data. Do not re-roll to make a number pass.
- `npm test` runs the parse-layer checks. Run it after touching `src/parse.ts`.

## Data shapes the agent passes rely on

- `senders.audit.findings`: string[] of ready-to-quote copy fragments. `reply_deliverable: false` means a reply would bounce; skip those.
- `senders.enrichment`: `{ source: "email_signature" | "vendor" | "not_found", real_company?: { company, person?, title?, site? } }`.
- `drafts`: `{ domain, contact_name, contact_email, subject, body, status }`.
