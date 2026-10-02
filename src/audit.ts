// Free deliverability audit per qualified domain — pure DNS + their own email's
// auth headers. Zero LLM cost. Usage: npm run audit [-- --domain acme.com] [-- --force]
import { resolveTxt, resolveMx } from "node:dns/promises";
import gatewayMap from "./gateway-map.json" with { type: "json" };
import { supabase, flag } from "./lib.js";

async function txt(name: string): Promise<string[]> {
  try {
    return (await resolveTxt(name)).map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

async function mx(domain: string): Promise<string[]> {
  try {
    const recs = await resolveMx(domain);
    return recs.sort((a, b) => a.priority - b.priority).map((r) => r.exchange.toLowerCase().replace(/\.$/, ""));
  } catch {
    return [];
  }
}

function matchSuffix(host: string, suffixes: string[]): boolean {
  return suffixes.some((s) => host === s || host.endsWith(`.${s}`));
}

function detectInfra(mxHosts: string[], spfRecord: string | null) {
  let gateway: string | null = null;
  let provider: string | null = null;
  for (const host of mxHosts) {
    for (const [vendor, def] of Object.entries(gatewayMap.gateways)) {
      if (matchSuffix(host, def.suffixes)) gateway = gateway ?? vendor;
    }
    for (const [name, def] of Object.entries(gatewayMap.mailbox_providers)) {
      if (matchSuffix(host, def.mx_suffixes)) provider = provider ?? name;
    }
  }
  // Behind a gateway the mailbox provider hides in SPF includes
  if (!provider && spfRecord) {
    for (const [name, def] of Object.entries(gatewayMap.mailbox_providers)) {
      if (def.spf_includes.some((inc) => spfRecord.includes(inc))) provider = name;
    }
  }
  return { gateway, provider };
}

async function auditDomain(domain: string, evidence: { spf: string | null; dkim: string | null; dmarc: string | null } | null, receivedAt: string | null) {
  const [rootTxt, dmarcTxt, mxHosts] = await Promise.all([txt(domain), txt(`_dmarc.${domain}`), mx(domain)]);
  const spfRecord = rootTxt.find((r) => r.toLowerCase().startsWith("v=spf1")) ?? null;
  const dmarcRecord = dmarcTxt.find((r) => r.toLowerCase().startsWith("v=dmarc1")) ?? null;
  const dmarcPolicy = dmarcRecord?.match(/\bp=(\w+)/i)?.[1]?.toLowerCase() ?? null;
  const { gateway, provider } = detectInfra(mxHosts, spfRecord);

  const findings: string[] = [];
  const date = receivedAt ? new Date(receivedAt).toISOString().slice(0, 10) : null;
  const ev = (check: "spf" | "dkim" | "dmarc") => evidence?.[check];
  for (const check of ["spf", "dkim", "dmarc"] as const) {
    const v = ev(check);
    if (v && v !== "pass") {
      findings.push(
        `The email you sent${date ? ` on ${date}` : ""} failed ${check.toUpperCase()} (Gmail marked it "${v}") — a direct spam-folder trigger.`,
      );
    }
  }
  if (!spfRecord) findings.push(`${domain} publishes no SPF record — receivers can't verify your sending servers.`);
  if (!dmarcRecord) {
    findings.push(`${domain} has no DMARC record — Gmail and Outlook now require one for bulk senders, and without it spoofing your domain is trivial.`);
  } else if (dmarcPolicy === "none") {
    findings.push(`Your DMARC policy is p=none — it monitors but doesn't protect, and mailbox providers score that accordingly.`);
  }
  if (findings.length === 0) {
    findings.push(
      `SPF, DKIM and DMARC all pass, yet the email still landed in spam — which points at sender reputation or content/volume issues, the harder half of deliverability.`,
    );
  }

  return {
    spf_record: spfRecord,
    dmarc_record: dmarcRecord,
    dmarc_policy: dmarcPolicy,
    mx_hosts: mxHosts,
    gateway,
    mailbox_provider: provider,
    evidence_auth: evidence,
    findings,
    checked_at: new Date().toISOString(),
  };
}

const only = flag("domain");
const force = flag("force") !== undefined;

let query = supabase
  .from("senders")
  .select("domain, evidence_gmail_id, emails!senders_evidence_gmail_id_fkey(auth_results, received_at)")
  .eq("qualified", true);
if (only) query = query.eq("domain", only);
if (!force) query = query.is("audit", null);
const { data: targets, error } = await query;
if (error) throw error;

console.log(`Auditing ${targets.length} domains`);
for (const t of targets) {
  const evidenceEmail = t.emails as unknown as { auth_results: any; received_at: string | null } | null;
  const ar = evidenceEmail?.auth_results ?? null;
  const audit = await auditDomain(
    t.domain,
    ar ? { spf: ar.spf, dkim: ar.dkim, dmarc: ar.dmarc } : null,
    evidenceEmail?.received_at ?? null,
  );
  const { error } = await supabase.from("senders").update({ audit }).eq("domain", t.domain);
  if (error) throw error;
  console.log(`  ${t.domain}: dmarc=${audit.dmarc_policy ?? "none"} provider=${audit.mailbox_provider ?? "?"} findings=${audit.findings.length}`);
}
console.log("Done");
