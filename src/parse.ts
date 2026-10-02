// Pure Gmail message parsing — no I/O, testable.
import type { gmail_v1 } from "googleapis";

type Header = gmail_v1.Schema$MessagePartHeader;

export function header(headers: Header[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function parseFrom(from: string): { name: string; email: string; domain: string } {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : from).trim().toLowerCase();
  const name = (m ? m[1] : "").trim();
  const domain = email.split("@")[1] ?? "";
  return { name, email, domain };
}

// Gmail's Authentication-Results header carries the receiver's verdict on the
// sender's SPF/DKIM/DMARC — the raw material for the audit pitch.
export function parseAuthResults(raw: string) {
  const get = (k: string) => raw.match(new RegExp(`\\b${k}=(\\w+)`, "i"))?.[1]?.toLowerCase() ?? null;
  return { raw: raw || null, spf: get("spf"), dkim: get("dkim"), dmarc: get("dmarc") };
}

function decodeB64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const texts: string[] = [];
  const htmls: string[] = [];
  const walk = (p: gmail_v1.Schema$MessagePart) => {
    if (p.body?.data) {
      if (p.mimeType === "text/plain") texts.push(decodeB64Url(p.body.data));
      else if (p.mimeType === "text/html") htmls.push(decodeB64Url(p.body.data));
    }
    p.parts?.forEach(walk);
  };
  walk(payload);
  if (texts.length) return texts.join("\n");
  return htmls
    .join("\n")
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
