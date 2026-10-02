// Smallest check that fails if parsing breaks: npm test
import assert from "node:assert/strict";
import { parseFrom, parseAuthResults, extractBody } from "./parse.js";

assert.deepEqual(parseFrom('"Jane Doe" <jane@acme.com>'), { name: "Jane Doe", email: "jane@acme.com", domain: "acme.com" });
assert.deepEqual(parseFrom("Bob <BOB@Sub.Example.IO>"), { name: "Bob", email: "bob@sub.example.io", domain: "sub.example.io" });
assert.deepEqual(parseFrom("noreply@foo.com"), { name: "", email: "noreply@foo.com", domain: "foo.com" });

const ar = parseAuthResults(
  "mx.google.com; dkim=pass header.i=@acme.com; spf=softfail (google.com: domain of x@acme.com...) smtp.mailfrom=x@acme.com; dmarc=fail (p=NONE) header.from=acme.com",
);
assert.equal(ar.spf, "softfail");
assert.equal(ar.dkim, "pass");
assert.equal(ar.dmarc, "fail");
assert.deepEqual(parseAuthResults(""), { raw: null, spf: null, dkim: null, dmarc: null });

const b64 = (s: string) => Buffer.from(s).toString("base64url");
assert.equal(
  extractBody({ mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: b64("hello plain") } }, { mimeType: "text/html", body: { data: b64("<p>hello html</p>") } }] }),
  "hello plain",
);
assert.equal(extractBody({ mimeType: "text/html", body: { data: b64("<style>x{}</style><p>Buy &nbsp;now</p>") } }), "Buy now");

console.log("parse.test.ts: all checks passed");
