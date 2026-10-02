import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

try {
  process.loadEnvFile();
} catch {
  // no .env — rely on exported vars
}

export function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing ${name} — set it in .env (see .env.example)`);
  return v;
}

export const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_KEY"));

export async function gmailClient() {
  const tokenPath = env("GOOGLE_TOKEN", "./token.json");
  let token;
  try {
    token = JSON.parse(readFileSync(tokenPath, "utf8"));
  } catch {
    throw new Error(`No token at ${tokenPath} — run \`npm run auth\` first`);
  }
  const auth = google.auth.fromJSON(token) as any;
  return google.gmail({ version: "v1", auth });
}

// Freemail senders get no domain rollup: a domain audit of gmail.com is meaningless.
export const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "live.com", "msn.com", "icloud.com", "me.com", "proton.me", "protonmail.com",
  "aol.com", "gmx.com", "gmx.net", "mail.com", "yandex.com", "zohomail.com",
]);

export function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : (process.argv[i + 1] ?? "true");
}
