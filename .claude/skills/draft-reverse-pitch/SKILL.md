---
name: draft-reverse-pitch
description: Use after enrich-senders to write the reverse-pitch email for each qualified, audited, enriched sender ("your email to me landed in spam, here is why"). Give-first cold email under 90 words with one interest CTA. Writes `drafts` rows; never sends. Three samples for approval before any batch.
---

# Draft the reverse-pitch

The hook is that every claim is verifiable by the prospect in 30 seconds: it is their domain,
their DNS, their email. The audit is the give. The operator's business is whatever the pitch
block says it is.

## Before writing

1. Read the pitch block: `PITCH.local.md` if it exists (gitignored, for operators who do not
   want their pitch in version control), otherwise the "Your pitch" block in
   [AGENTS.md](../../../AGENTS.md). If any field is empty, ask the operator and stop. Do not
   invent a credibility line.
2. Ask which angle to use (below) if the operator has not said. Default to Angle A.
3. Pull the queue:
   ```bash
   npm run rows -- pending draft
   ```
   Rows already exclude domains with a draft and domains where a reply would bounce.

## Per row

1. **Display name.** `enrichment.real_company.company` if present, else "your sending domain".
   Never quote a raw burner domain; it reads like log output. Exceptions: a short genuine
   brand domain, or when the domain itself is the finding ("a .click domain", "a shared relay").
2. **Their pitch, referenced specifically.** One clause from `subject` or `body_text` that
   proves a human read it: "your note about appointment setting for SaaS teams".
3. **One finding.** Pick the single strongest line from `audit.findings`, in this order:
   their own email failed SPF, DKIM or DMARC; no DMARC record; DMARC p=none; no SPF; all pass
   but still spam (reputation). Rewrite it in plain words. One finding only.
4. **Write to one of the two angles.**

## The two angles

Both are examples. They show the shape; they are not the pitch. Operators should write their
own bridge line and are free to write their own angle entirely.

### Angle A: The observation (default)

Observation, implication, bridge, one ask. The prospect feels seen, not sold.

> **Subject:** {Company} + spam
>
> {First name}, your {their pitch, referenced specifically} reached me, in the spam folder.
>
> Took a look at why: {the one finding, plain words}. If it tripped my inbox, it is tripping most of the list.
>
> I run {YOUR_COMPANY}, {WHAT_YOU_DO}. Put together {THE_GIVE} for {display name}.
>
> Want me to send it over?

Example, filled in:

> **Subject:** Acme Outbound + spam
>
> Jo, your note about appointment setting for SaaS teams reached me, in the spam folder.
>
> Took a look at why: Acme Outbound's sending domain has DMARC set to p=none, so Gmail scores it as unprotected. If it tripped my inbox, it is tripping most of the list.
>
> I run Northline, we build the outbound systems agencies run for their clients. Put together a short teardown of what is hurting your sends and the fix order.
>
> Want me to send it over?

### Angle B: The live demo

The email itself is the proof of what you do. Works when the operator builds systems, AI
workflows, or pipelines, because the prospect is reading the output of one.

> **Subject:** Your email, reverse engineered
>
> {First name}, your pitch landed in my spam folder. A pipeline I built pulled it out, read the headers, checked {display name}'s DNS, and wrote this reply. Cost: under a cent.
>
> The one thing it flagged: {the one finding, plain words}.
>
> That pipeline is the kind of thing {YOUR_COMPANY} builds, {WHAT_YOU_DO}. Happy to share {THE_GIVE}.
>
> Want to see what else it found?

Example, filled in:

> **Subject:** Your email, reverse engineered
>
> Jo, your pitch landed in my spam folder. A pipeline I built pulled it out, read the headers, checked Acme Outbound's DNS, and wrote this reply. Cost: under a cent.
>
> The one thing it flagged: the email you sent on 24 Sep failed DKIM, which Gmail treats as a direct spam signal.
>
> That pipeline is the kind of thing Northline builds, we put AI systems behind GTM teams. Happy to share the full teardown of your domain.
>
> Want to see what else it found?

## Hard rules

- Under 90 words. No links, images, or attachments. Plain text.
- Sentence case, like a person typing. Subject 2 to 5 words, no clickbait.
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
      "subject": "Acme Outbound + spam", "body": "..." }]
   ```
4. Report: drafted count, skipped count with reasons (no finding, no first name, thin pitch).

## QA before saving each draft

- [ ] Under 90 words, one question mark, no dashes, no links
- [ ] Finding is quoted from the audit, not invented
- [ ] Display name is a real company or "your sending domain", never a raw burner
- [ ] Credibility line matches `WHAT_YOU_DO` word for word in meaning
- [ ] Would a stranger reply to this? If not, cut, do not add

Full frameworks, follow-up arc, spintax and scoring rubric: the `b2b-cold-email-copywriting`
and `campaign-copywriting` skills in [GTM-Skills](https://github.com/automatewithuday/GTM-Skills) (MIT),
and `copy-frameworks` and `personalization-engine` in [gtm-flywheel](https://github.com/automatewithuday/gtm-flywheel).
