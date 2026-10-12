// Data access for the two Claude-run passes (enrich, draft), so an agent never
// needs a database tool. Usage:
//   npm run rows -- pending enrich            qualified senders with no enrichment, plus the evidence email
//   npm run rows -- pending draft             enriched + audited senders with no draft row
//   npm run rows -- set-enrichment <file>     file: {domain, enrichment} or an array of them
//   npm run rows -- add-draft <file>          file: {domain, contact_name, contact_email, subject, body} or an array
import { readFileSync } from "node:fs";
import { supabase } from "./lib.js";

const [cmd, arg] = process.argv.slice(2);
const readJson = (p: string) => {
  const v = JSON.parse(readFileSync(p, "utf8"));
  return Array.isArray(v) ? v : [v];
};

if (cmd === "pending" && arg === "enrich") {
  const { data, error } = await supabase
    .from("senders")
    .select("domain, segment, business_type, emails!senders_evidence_gmail_id_fkey(from_name, from_email, subject, body_text)")
    .eq("qualified", true)
    .is("enrichment", null);
  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
} else if (cmd === "pending" && arg === "draft") {
  const { data, error } = await supabase
    .from("senders")
    .select("domain, segment, business_type, audit, enrichment, emails!senders_evidence_gmail_id_fkey(from_name, from_email, subject, body_text)")
    .eq("qualified", true)
    .not("audit", "is", null)
    .not("enrichment", "is", null);
  if (error) throw error;
  const { data: drafted, error: dErr } = await supabase.from("drafts").select("domain");
  if (dErr) throw dErr;
  const done = new Set(drafted.map((d) => d.domain));
  // Skip domains whose MX refuses mail: the prospect could never reply.
  const rows = data.filter((s) => !done.has(s.domain) && s.audit?.reply_deliverable !== false);
  console.log(JSON.stringify(rows, null, 2));
} else if (cmd === "set-enrichment" && arg) {
  for (const { domain, enrichment } of readJson(arg)) {
    const { error } = await supabase
      .from("senders")
      .update({ enrichment: { ...enrichment, checked_at: new Date().toISOString() } })
      .eq("domain", domain);
    if (error) throw error;
    console.log(`  ${domain}: ${enrichment.source}`);
  }
} else if (cmd === "add-draft" && arg) {
  const rows = readJson(arg).map((d) => ({ ...d, status: "draft" }));
  const { error } = await supabase.from("drafts").insert(rows);
  if (error) throw error;
  console.log(`Inserted ${rows.length} drafts`);
} else {
  console.error("Usage: npm run rows -- pending enrich | pending draft | set-enrichment <file> | add-draft <file>");
  process.exit(1);
}
