// One-time Gmail OAuth consent flow (readonly scope). Saves a refresh token.
import { readFileSync, writeFileSync } from "node:fs";
import { authenticate } from "@google-cloud/local-auth";

try {
  process.loadEnvFile();
} catch {}

const CRED_PATH = process.env.GOOGLE_CREDENTIALS ?? "./credentials.json";
const TOKEN_PATH = process.env.GOOGLE_TOKEN ?? "./token.json";
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

const client = await authenticate({ scopes: SCOPES, keyfilePath: `${process.cwd()}/${CRED_PATH.replace(/^\.\//, "")}` });
if (!client.credentials.refresh_token) {
  throw new Error("No refresh token returned — remove the app from https://myaccount.google.com/permissions and re-run");
}
const keys = JSON.parse(readFileSync(CRED_PATH, "utf8"));
const key = keys.installed ?? keys.web;
writeFileSync(
  TOKEN_PATH,
  JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  }),
);
console.log(`Token saved to ${TOKEN_PATH}`);
