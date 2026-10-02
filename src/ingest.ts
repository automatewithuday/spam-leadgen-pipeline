// Pull spam-folder emails into Supabase. Idempotent on gmail_id. Usage: npm run ingest [-- --max 25]
import { gmailClient, supabase, flag } from "./lib.js";
import { header, parseFrom, parseAuthResults, extractBody } from "./parse.js";

const MAX = Number(flag("max") ?? Infinity);

const gmail = await gmailClient();

const { data: existingRows, error: exErr } = await supabase.from("emails").select("gmail_id");
if (exErr) throw exErr;
const existing = new Set(existingRows.map((r) => r.gmail_id));

// List spam message ids
const ids: string[] = [];
let pageToken: string | undefined;
do {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "in:spam",
    maxResults: 100,
    pageToken,
    includeSpamTrash: true,
  });
  for (const m of res.data.messages ?? []) if (m.id) ids.push(m.id);
  pageToken = res.data.nextPageToken ?? undefined;
} while (pageToken && ids.length < MAX);

const newIds = ids.filter((id) => !existing.has(id)).slice(0, MAX);
console.log(`Spam folder: ${ids.length} messages, ${newIds.length} new to ingest`);

let done = 0;
for (const id of newIds) {
  const { data: msg } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const headers = msg.payload?.headers ?? [];
  const from = parseFrom(header(headers, "From"));
  const row = {
    gmail_id: id,
    thread_id: msg.threadId ?? null,
    from_name: from.name,
    from_email: from.email,
    from_domain: from.domain,
    subject: header(headers, "Subject"),
    snippet: msg.snippet ?? null,
    body_text: extractBody(msg.payload ?? undefined).slice(0, 20000),
    auth_results: parseAuthResults(header(headers, "Authentication-Results")),
    received_at: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
  };
  const { error } = await supabase.from("emails").upsert(row);
  if (error) throw error;
  done++;
  if (done % 25 === 0) console.log(`  ${done}/${newIds.length}`);
}
console.log(`Ingested ${done} emails`);
