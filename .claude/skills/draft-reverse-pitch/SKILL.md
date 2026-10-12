---
name: draft-reverse-pitch
description: Use after enrich-senders to write the reverse-pitch email for each qualified, audited, enriched sender ("your email to me landed in spam, here is why"). Give-first cold email under 90 words with one interest CTA. Writes `drafts` rows; never sends. Three samples for approval before any batch.
---

# Draft the reverse-pitch

The hook is that every claim is verifiable by the prospect in 30 seconds: it is their domain,
their DNS, their email. The audit is the give. The operator's business is whatever the pitch
block in [AGENTS.md](../../../AGENTS.md) says it is.

## Before writing

1. Read the "Your pitch" block in AGENTS.md. If any field is empty, ask the operator for it and
   stop. Do not invent a credibility line.
2. Pull the queue:
   ```bash
   npm run rows -- pending draft
   ```
   Rows already exclude domains with a draft and domains where a reply would bounce.

## Per row

1. **Display name.** `enrichment.real_company.company` if present, else "your sending domain".
   Never quote a raw burner domain; it reads like log output. Exceptions: a short genuine
   brand domain, or when the domain itself is the finding ("a .click domain", "a shared relay").
2. **Their pitch, referenced specifically.** One clause from `subject` or `body_text` that
   proves a human read it: "your note about appointment setting for saas teams".
3. **One finding.** Pick the single strongest line from `audit.findings`, in this order:
   their own email failed SPF, DKIM or DMARC; no DMARC record; DMARC p=none; no SPF; all pass
   but still spam (reputation). Rewrite it in plain words. One finding only.
4. **Write to the template.**

   > **subject:** {2 to 4 words, lowercase, reads like an internal note: "your dkim", "{company} + spam"}
   >
   > {first name}, your {their pitch, referenced specifically} reached me, in the spam folder.
   >
   > took a look at why: {the one finding, plain words}.
   >
   > i run {YOUR_COMPANY}, {WHAT_YOU_DO}. put together {THE_GIVE} for {display name}.
   >
   > want me to send it over?

## Hard rules

- Under 90 words. No links, images, or attachments. Plain text.
- One CTA, one question mark, interest-based. Never a calendar ask.
- No em or en dashes. Commas, colons, full stops.
- "you/your" outnumbers "we/our". Open with them, not "I".
- Banned: "I hope this finds you well", "I wanted to reach out", "leverage", "game-changer",
  "cutting-edge", "seamless", "free", "guarantee", "act now", fake flattery, ALL CAPS, "!!".
- No facts the audit or the email does not contain. No hallucinated names or numbers.
- 5th-grade reading level. Reads aloud in under 20 seconds.

## Approval gate, then batch

1. Write three drafts. Show them to the operator with the finding each one used.
2. Wait for approval or edits. Apply edits as rules for the rest of the batch.
3. Draft the remainder, run the QA list below on each, save:
   ```bash
   npm run rows -- add-draft /path/to/drafts.json
   ```
   ```json
   [{ "domain": "acmeflow.click", "contact_name": "Jo", "contact_email": "jo@acmeflow.click",
      "subject": "your dmarc", "body": "..." }]
   ```
4. Report: drafted count, skipped count with reasons (no finding, no first name, thin pitch).

## QA before saving each draft

- [ ] Under 90 words, one question mark, no dashes, no links
- [ ] Finding is quoted from the audit, not invented
- [ ] Display name is a real company or "your sending domain", never a raw burner
- [ ] Credibility line matches `WHAT_YOU_DO` word for word in meaning
- [ ] Would a stranger reply to this? If not, cut, do not add

Full frameworks, follow-up arc, spintax and scoring rubric: the `b2b-cold-email-copywriting`
and `campaign-copywriting` skills in [GTM-Skills](https://github.com/automatewithuday/GTM-Skills) (MIT).
