// Static tests for application links: one `?ref=<company>` link per job
// application, so PostHog can say which applications turned into visits
// (docs/application-links.md). Run by `npm run eval`.
//
// What this suite holds:
//
//   1. **The ref is counted, never shown.** The repo is public, so an allowlist
//      of companies would publish who Sidhant has applied to, and echoing the
//      URL would let anyone make the page say anything. The only code that
//      reads the parameter is lib/analytics.ts, and the only place the value
//      goes is a PostHog session property.
//   2. **A slug or nothing.** No email address or person's name gets through.
//   3. **The ref and the fragment combine in either order**, because the
//      natural way to add a ref to a copied permalink is to paste it on the end.
//   4. **The fragment never reaches PostHog.** The permalink's whole claim is
//      that the conversation stays in the browser.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { ROOT, read } from "./lib/artifacts.mjs";
import { REF_PARAM, readRef } from "../lib/analytics.ts";
import { decodeSnapshot, payloadFromHash, permalinkFor } from "../lib/permalink.ts";

/** Every hand-written source file under the given directories. */
function sources(...dirs) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx?|mdx?|mjs)$/.test(name) && !/\.generated\.ts$/.test(name)) {
        out.push(relative(ROOT, path));
      }
    }
  };
  for (const dir of dirs) walk(join(ROOT, dir));
  return out;
}

const SITE_SOURCES = sources("app", "components", "content", "lib");

describe("the ref is read", () => {
  test("a company slug is accepted, and lowercased", () => {
    assert.equal(REF_PARAM, "ref");
    assert.equal(readRef("?ref=acme"), "acme");
    assert.equal(readRef("?ref=northwind-data"), "northwind-data");
    assert.equal(readRef("?ref=Acme"), "acme");
    assert.equal(readRef("?ref=acme2026"), "acme2026");
    assert.equal(readRef("?utm_source=x&ref=acme"), "acme");
  });

  test("anything that isn't a slug is dropped, not cleaned up", () => {
    // The convention is a company slug. A person's name with a space, an
    // email address, or markup is not tracked at all.
    for (const bad of [
      "?ref=jane%40acme.com",
      "?ref=jane@acme.com",
      "?ref=Jane%20Doe",
      "?ref=jane+doe",
      "?ref=%3Cscript%3E",
      "?ref=../etc",
      "?ref=-acme",
      "?ref=acme-",
      "?ref=acme.com",
      `?ref=${"a".repeat(41)}`,
      "?ref=",
      "",
    ]) {
      assert.equal(readRef(bad), null, `${bad} got through`);
    }
    assert.equal(readRef(`?ref=${"a".repeat(40)}`), "a".repeat(40));
  });

  test("a ref pasted after the fragment is found, and the query wins when both exist", () => {
    assert.equal(readRef("", "#c=abc?ref=acme"), "acme");
    assert.equal(readRef("", "#c=abc&ref=acme"), "acme");
    assert.equal(readRef("?ref=first", "#c=abc?ref=second"), "first");
    assert.equal(readRef("", "#c=abc"), null);
    // A payload can't smuggle one in: base64url has no `?` or `&`.
    assert.equal(readRef("", "#c=refacme"), null);
  });
});

describe("the ref combines with a permalink", () => {
  const messages = [
    { role: "user", parts: [{ type: "text", text: "What did he build at Nokia?" }] },
    { role: "assistant", parts: [{ type: "text", text: "A Power App [resume:nokia]." }] },
  ];

  test("?ref= before the fragment: the browser splits them, both are read", async () => {
    const link = await permalinkFor("https://sidhantmathur.com/?ref=acme", messages);
    const url = new URL(link);
    assert.equal(url.pathname, "/");
    assert.equal(url.search, "?ref=acme");
    assert.equal(readRef(url.search, url.hash), "acme");
    const back = await decodeSnapshot(payloadFromHash(url.hash));
    assert.equal(back[1].parts[0].text, "A Power App [resume:nokia].");
  });

  test("?ref= pasted on the end lands inside the fragment, and still works", async () => {
    const link = `${await permalinkFor("https://sidhantmathur.com/", messages)}?ref=acme`;
    const url = new URL(link);
    assert.equal(url.search, "", "the browser does not see a query here");
    assert.ok(url.hash.endsWith("?ref=acme"));
    assert.equal(readRef(url.search, url.hash), "acme");
    const back = await decodeSnapshot(payloadFromHash(url.hash));
    assert.equal(back?.length, 2, "the appended ref broke the replay");
  });
});

describe("the ref is never rendered", () => {
  test("only lib/analytics.ts reads the ref parameter", () => {
    // Any other reader is a step toward showing it. The chat route's
    // `simulate` and the transport's copy of it are the only other query
    // reads on the site, and neither touches `ref`.
    const readers = SITE_SOURCES.filter((file) => {
      const src = read(file);
      return (
        /useSearchParams/.test(src) ||
        /\.get\(\s*["'`]ref["'`]\s*\)/.test(src) ||
        /\b(?:readRef|rememberLanding|REF_PARAM)\b/.test(src)
      );
    });
    assert.deepEqual(
      readers.sort(),
      ["components/analytics-provider.tsx", "lib/analytics.ts"],
      "something outside analytics reads the ref",
    );
    // The provider only triggers the read; it never holds the value.
    const provider = read("components/analytics-provider.tsx");
    assert.match(provider, /rememberLanding\(\);/);
    assert.doesNotMatch(provider, /=\s*rememberLanding|readRef|REF_PARAM/);
  });

  test("the value goes to a PostHog session property and nowhere else", () => {
    const src = read("lib/analytics.ts");
    // landingRef: declared, assigned from readRef, checked, registered. That
    // is the whole list; a fifth use is a new destination.
    const uses = [...src.matchAll(/\blandingRef\b/g)].length;
    assert.equal(uses, 5, `landingRef is used ${uses} times — read what the new use does with it`);
    assert.match(src, /landingRef = readRef\(window\.location\.search, window\.location\.hash\)/);
    assert.match(src, /if \(landingRef\) ph\.register_for_session\(\{ \[REF_PARAM\]: landingRef \}\)/);
    // A session property, not a person property and not a persistent super
    // property: it describes this visit, not a visitor.
    assert.doesNotMatch(src, /\bregister\(|register_once|\$set|identify\(/);
    // Nothing is exported that would hand the value to a component.
    assert.doesNotMatch(src, /export (?:const|let|function) \w*(?:landing|Landing)Ref/);
  });

  test("no page or component interpolates anything from the address bar", () => {
    // The broader version of the rule: text taken from the URL is never
    // rendered. location.search is read in exactly three places, none of
    // which renders it.
    const readers = SITE_SOURCES.filter((file) => /location\.search/.test(read(file))).sort();
    assert.deepEqual(readers, [
      "components/shell/use-conversation.ts", // ?simulate= → the chat endpoint
      "components/shell/use-panel-url.ts", // carried through pushState untouched
      "lib/analytics.ts", // the ref, to PostHog
    ]);
    assert.doesNotMatch(read("components/shell/use-panel-url.ts"), /searchParams|URLSearchParams/);
  });
});

describe("the fragment stays in the browser", () => {
  test("PostHog is told not to record URL fragments", () => {
    // posthog-js reports location.href — fragment and all — as $current_url,
    // $session_entry_url and $initial_current_url unless this is set, which
    // would upload every opened permalink's conversation.
    const src = read("lib/analytics.ts");
    assert.match(src, /disable_capture_url_hashes: true/);
  });

  test("events fired before the SDK arrives are held, not dropped", () => {
    // `chat_permalink_opened` fires the moment a fragment decodes, always
    // before the SDK has loaded. Dropping it meant no opened link was counted.
    const src = read("lib/analytics.ts");
    assert.match(src, /pending\.push\(\[event, props\]\)/);
    assert.match(src, /for \(const \[event, props\] of pending\.splice\(0\)\) posthog\.capture\(event, props\)/);
    assert.match(src, /pending\.length < MAX_PENDING/);
  });

  test("the landing address is read on mount, before the idle init", () => {
    const provider = read("components/analytics-provider.tsx");
    const mount = provider.indexOf("rememberLanding();");
    const idle = provider.indexOf("setTimeout");
    assert.ok(mount !== -1 && mount < idle, "the ref is read after something could have replaced the address");
  });
});
