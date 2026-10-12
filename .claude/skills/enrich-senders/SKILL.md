---
name: enrich-senders
description: Use after `npm run audit` to find the real company and person behind each qualified sender's burner domain. Signature extraction first (free), paid vendor lookup last and only with permission. Writes `senders.enrichment`.
---

# Enrich qualified senders

Cold-outbound sending domains are burners (`somethingflow.click`, `brandnamehub.com`). Data
vendors have never seen them: on this pipeline's first run, email-to-LinkedIn lookup returned
0 hits in 15 tries. The email signature names the real company, because a pitch has to be
signed by someone. Start there.

## Steps

1. Pull the queue:
   ```bash
   npm run rows -- pending enrich
   ```
   Each row carries the evidence email: `from_name`, `from_email`, `subject`, `body_text`.

2. For each row, read the signature block (usually the last 10 to 15 lines of `body_text`)
   and the body for: company name, person, title, website. Rules:
   - A site or company named in the signature that differs from the sending domain is the real company.
   - Take only what is written. No guessing from the domain name, no web lookups at this step.
   - Nothing usable: `{ "source": "not_found" }`. That is a valid answer.

3. Contact is always the sender. They emailed the operator and they monitor replies; that is
   the point of their campaign. `contact_email` is `from_email`, `contact_name` is the signer
   or `from_name`.

4. Paid vendor lookup (optional, last): only for rows with a confirmed real company, only when
   the operator has a data tool configured, and only after telling the operator the expected
   credit cost and getting a yes. Never spend credits on a bare burner domain.

5. Write results to a JSON file in the scratchpad and save:
   ```bash
   npm run rows -- set-enrichment /path/to/enrichment.json
   ```
   ```json
   [
     { "domain": "acmeflow.click",
       "enrichment": { "source": "email_signature",
                       "real_company": { "company": "Acme Digital", "person": "Jo Lee", "title": "Founder", "site": "acmedigital.com" } } },
     { "domain": "noidea.com", "enrichment": { "source": "not_found" } }
   ]
   ```

6. Report counts: found by signature, found by vendor, not found. If a real company is clearly
   outside the ICP (a large SaaS whose SDR used a burner, a recruiter), tell the operator and
   leave `qualified` alone. Changing qualification is their call.
