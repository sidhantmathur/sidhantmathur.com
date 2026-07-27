// Static tests for the export surface (roadmap Sprint 5: #17, #18, #24, #13,
// #27). Run by `npm run eval` under `node --test --experimental-strip-types`.
//
// Three things this suite exists to hold:
//
//   1. **The 10-turn cap.** The route caps a conversation at 10 user turns, and
//      that cap is the entire reason the permalink is viable without storage.
//      Every export path is exercised against the largest conversation the site
//      can actually produce — including one carrying a 3,000-character job
//      posting and a full requirement table, which is the case the length
//      estimate in docs/idea-decisions.md did NOT cover.
//   2. **Every gap survives every transport.** Sprint 4's whole argument is
//      that the assessment is honest by construction; an export that drops the
//      unmet rows on the way to a recruiter's inbox undoes it silently.
//   3. **A fragment is untrusted input.** It arrives from whoever sent the
//      link, so the decoder is tested on garbage, on truncation, and on a
//      hand-written payload, and is required to answer "no" rather than to
//      throw.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { read } from "./lib/artifacts.mjs";
import {
  MAILTO_MAX_BODY,
  SNAPSHOT_VERSION,
  condense,
  conversationToMarkdown,
  fromSnapshot,
  latestRoleFit,
  mailtoHref,
  scorecardMarkdown,
  toSnapshot,
  verdictCounts,
} from "../lib/transcript.ts";
import {
  PERMALINK_PREFIX,
  PERMALINK_SAFE_CHARS,
  decodeSnapshot,
  encodeSnapshot,
  payloadFromHash,
  permalinkFor,
} from "../lib/permalink.ts";

// --- fixtures -------------------------------------------------------------

const userMsg = (text) => ({ role: "user", parts: [{ type: "text", text }] });
const toolPart = (type, output) => ({ type, state: "output-available", output });
const assistantMsg = (text, ...tools) => ({
  role: "assistant",
  parts: [{ type: "text", text }, ...tools],
});

/** A reconciled assessment, the shape lib/role-fit.ts returns. */
const FIT = {
  role: "GTM engineer",
  rows: [
    {
      requirement: "3+ years in revenue or sales operations",
      verdict: "met",
      claimedVerdict: null,
      downgrade: null,
      evidence: "Owns sales operations reporting at Nokia for 80+ stakeholders.",
      sources: ["resume:nokia"],
      unknownSources: [],
      unverified: [],
    },
    {
      requirement: "SQL against a warehouse",
      verdict: "partial",
      claimedVerdict: null,
      downgrade: null,
      evidence: "SQL and DAX at Nokia, though no cloud warehouse appears in the record.",
      sources: ["resume:nokia"],
      unknownSources: [],
      unverified: [],
    },
    {
      requirement: "dbt modeling",
      verdict: "unmet",
      claimedVerdict: null,
      downgrade: null,
      evidence: "No dbt anywhere in the record.",
      sources: [],
      unknownSources: [],
      unverified: [],
    },
    {
      requirement: "Manage a team of two analysts",
      verdict: "unclear",
      claimedVerdict: null,
      downgrade: "uncovered",
      evidence: "",
      sources: [],
      unknownSources: [],
      unverified: [],
    },
    {
      requirement: "Own the CRM data model",
      verdict: "unclear",
      claimedVerdict: "met",
      downgrade: "uncited",
      evidence: "He has done this.",
      sources: [],
      unknownSources: [],
      unverified: [],
    },
  ],
  counts: { met: 1, partial: 1, unmet: 1, unclear: 2 },
  gaps: ["No dbt or cloud warehouse experience.", "No direct people management in the record."],
  noGapsRationale: null,
  verdict: "Strong on the reporting half, short on the data-stack half.",
  uncovered: 1,
  downgraded: 2,
};

// A posting long enough to be the real thing: the route accepts 4,000
// characters of user text and the JD form caps its textarea at 3,500.
const POSTING =
  "We are hiring a GTM engineer.\n\n" +
  Array.from(
    { length: 40 },
    (_, i) =>
      `- Requirement ${i + 1}: own the ${i % 2 ? "reporting" : "pipeline"} surface for a team of ${i + 3}, working across Salesforce, Snowflake and dbt, and report to the VP of revenue operations.`,
  ).join("\n");

/** The largest conversation the site can produce: 10 user turns, one a posting. */
function tenTurnConversation() {
  const messages = [];
  for (let i = 0; i < 9; i += 1) {
    messages.push(userMsg(`Question ${i + 1}: what did he actually do at Nokia, in detail?`));
    messages.push(
      assistantMsg(
        `He migrated reporting for 80+ stakeholders onto Power BI [resume:nokia], and built a self-serve Power App on top of it. Turn ${i + 1} of a long conversation, with enough varied prose that the compressor cannot cheat: quarterly forecasting, partner enablement, and a migration off a legacy stack.`,
      ),
    );
  }
  messages.push(userMsg(POSTING));
  messages.push(
    assistantMsg(
      "Here is how the posting maps onto the record [resume:nokia].",
      toolPart("tool-roleFit", FIT),
    ),
  );
  return messages;
}

// --- the snapshot ---------------------------------------------------------

describe("snapshot", () => {
  test("round-trips text and tool output", () => {
    const messages = [userMsg("hi"), assistantMsg("there", toolPart("tool-roleFit", FIT))];
    const back = fromSnapshot(toSnapshot(messages));
    assert.equal(back.length, 2);
    assert.equal(back[0].role, "user");
    assert.equal(back[1].parts[1].type, "tool-roleFit");
    assert.deepEqual(back[1].parts[1].output, FIT);
  });

  test("drops messages that would render as nothing", () => {
    const snap = toSnapshot([userMsg(""), assistantMsg("real")]);
    assert.equal(snap.m.length, 1);
  });

  test("a snapshot from another version decodes to nothing", () => {
    assert.deepEqual(fromSnapshot({ v: SNAPSHOT_VERSION + 1, m: [{ r: "u", t: "hi" }] }), []);
  });

  test("only tool- prefixed parts survive the trip back in", () => {
    // A fragment is written by whoever sent the link. A part the shell has no
    // renderer for would ride in as a hole in the message list.
    const back = fromSnapshot({
      v: SNAPSHOT_VERSION,
      m: [{ r: "a", t: "text", p: [{ y: "script", o: { a: 1 } }, { y: "tool-roleFit", o: FIT }] }],
    });
    assert.equal(back[0].parts.length, 2);
    assert.equal(back[0].parts[1].type, "tool-roleFit");
  });

  test("garbage decodes to an empty conversation rather than throwing", () => {
    for (const value of [null, undefined, 42, "hi", {}, { v: 1 }, { v: 1, m: "no" }]) {
      assert.deepEqual(fromSnapshot(value), []);
    }
  });

  test("hostile message entries are skipped, not rendered", () => {
    const back = fromSnapshot({
      v: SNAPSHOT_VERSION,
      m: [null, 7, { r: "x", t: "nope" }, { r: "u" }, { r: "u", t: "kept" }],
    });
    assert.equal(back.length, 1);
    assert.equal(back[0].parts[0].text, "kept");
  });
});

// --- the permalink --------------------------------------------------------

describe("permalink", () => {
  test("round-trips a conversation through the fragment", async () => {
    const messages = [userMsg("What did he build at Nokia?"), assistantMsg("A Power App [resume:nokia].")];
    const link = await permalinkFor("https://sidhantmathur.com/", messages);
    assert.ok(link.startsWith(`https://sidhantmathur.com/${PERMALINK_PREFIX}`));
    const back = await decodeSnapshot(payloadFromHash(link.slice(link.indexOf("#"))));
    assert.equal(back.length, 2);
    assert.equal(back[1].parts[0].text, "A Power App [resume:nokia].");
  });

  test("the payload is URL-safe base64 — nothing needing escaping", async () => {
    const payload = await encodeSnapshot(toSnapshot(tenTurnConversation()));
    assert.match(payload, /^[A-Za-z0-9_-]+$/);
    assert.equal(encodeURIComponent(payload), payload);
  });

  test("an ordinary 10-turn conversation stays under the safe length", async () => {
    // Nine question-and-answer pairs, no posting: the conversation the length
    // estimate in docs/idea-decisions.md was made against.
    const ordinary = tenTurnConversation().slice(0, 18);
    const link = await permalinkFor("https://sidhantmathur.com/", ordinary);
    assert.ok(
      link.length < PERMALINK_SAFE_CHARS,
      `an ordinary conversation produced a ${link.length}-character link`,
    );
  });

  test("a conversation carrying a posting and an assessment still round-trips exactly", async () => {
    // It does NOT have to be short — a 3.5 kB posting cannot compress into a
    // tweet. It has to survive, and the surface has to be able to tell the
    // reader how long it is, which is why PERMALINK_SAFE_CHARS is exported.
    const messages = tenTurnConversation();
    const link = await permalinkFor("https://sidhantmathur.com/", messages);
    const back = await decodeSnapshot(payloadFromHash(link.slice(link.indexOf("#"))));
    assert.equal(back.length, messages.length);
    assert.deepEqual(latestRoleFit(back), FIT);
    assert.equal(back[18].parts[0].text, POSTING);
  });

  test("a truncated link decodes to null rather than to half a conversation", async () => {
    const payload = await encodeSnapshot(toSnapshot(tenTurnConversation()));
    assert.equal(await decodeSnapshot(payload.slice(0, Math.floor(payload.length / 2))), null);
  });

  test("garbage, empty and oversized payloads all answer null", async () => {
    assert.equal(await decodeSnapshot(""), null);
    assert.equal(await decodeSnapshot("not base64!!"), null);
    assert.equal(await decodeSnapshot("aaaa"), null);
    assert.equal(await decodeSnapshot("A".repeat(70_000)), null);
  });

  test("payloadFromHash only reads its own key", () => {
    assert.equal(payloadFromHash("#c=abc"), "abc");
    assert.equal(payloadFromHash("#resume"), null);
    assert.equal(payloadFromHash(""), null);
    assert.equal(payloadFromHash("#c="), null);
  });
});

// --- the scorecard --------------------------------------------------------

describe("scorecard", () => {
  const labels = {
    counts: "Coverage",
    evidence: "Strongest evidence",
    gaps: "What he doesn't have",
    noGaps: "No unmet requirements — why",
  };

  test("carries the verdict, the counts, and at most three evidence rows", () => {
    const md = scorecardMarkdown(FIT, { title: "Sidhant Mathur", labels });
    assert.match(md, /# Sidhant Mathur — GTM engineer/);
    assert.match(md, /Strong on the reporting half/);
    assert.match(md, /Coverage: 1 met · 1 partial · 1 unmet · 2 unclear/);
    // Two rows cite something; the rest are absences, and an absence is not
    // evidence. They are all still in the gaps section below.
    const rows = md.match(/^- \*\*/gm) ?? [];
    assert.equal(rows.length, 2);
  });

  test("EVERY gap travels, never truncated", () => {
    // The one assertion in this file that is about honesty rather than about
    // formatting: a forwarded assessment that lost a gap is the flattering
    // half of what was on screen.
    const md = scorecardMarkdown(FIT, { labels });
    for (const gap of FIT.gaps) assert.ok(md.includes(gap), `gap dropped: ${gap}`);
  });

  test("the cited ids travel with the claim", () => {
    const md = scorecardMarkdown(FIT, { labels });
    assert.match(md, /\[resume:nokia\]/);
  });

  test("the strongest rows are the cited, judged ones", () => {
    const md = scorecardMarkdown(FIT, { labels });
    assert.match(md, /- \*\*met\*\* — 3\+ years/);
    assert.match(md, /- \*\*partial\*\* — SQL against a warehouse/);
    // The uncited downgraded row has nothing to stand on and doesn't lead.
    assert.ok(!md.includes("He has done this."));
    // Neither does an honest unmet row: it is in the gaps, not the evidence.
    assert.ok(!md.includes("No dbt anywhere in the record."));
  });

  test("no gaps falls through to the model's rationale", () => {
    const md = scorecardMarkdown(
      { ...FIT, gaps: [], noGapsRationale: "Every requirement is covered by the record." },
      { labels },
    );
    assert.ok(!md.includes("What he doesn't have"));
    assert.match(md, /Every requirement is covered/);
  });

  test("counts come from the reconciler when it supplied them", () => {
    assert.equal(verdictCounts(FIT), "1 met · 1 partial · 1 unmet · 2 unclear");
    // And are counted from the rows when it didn't — a snapshot from an older
    // link has rows but no counts object.
    assert.equal(verdictCounts({ rows: FIT.rows }), "1 met · 1 partial · 1 unmet · 2 unclear");
  });

  test("nothing here composes a sentence of its own", () => {
    // Every line is the model's, the posting's, or a caller-supplied label.
    const md = scorecardMarkdown(FIT, {});
    for (const line of md.split("\n").filter((l) => l.trim())) {
      const bare = line.replace(/^[-#*\s]+/, "").replace(/\*\*/g, "");
      const known =
        FIT.gaps.some((g) => bare.includes(g)) ||
        FIT.rows.some((r) => bare.includes(r.requirement)) ||
        bare.includes(FIT.verdict) ||
        bare === FIT.role ||
        /^\d+ (met|partial|unmet|unclear)/.test(bare);
      assert.ok(known, `unexpected prose in the scorecard: ${line}`);
    }
  });

  test("latestRoleFit finds the most recent assessment", () => {
    const messages = [
      assistantMsg("first", toolPart("tool-roleFit", { role: "old" })),
      assistantMsg("second", toolPart("tool-roleFit", FIT)),
    ];
    assert.equal(latestRoleFit(messages).role, "GTM engineer");
    assert.equal(latestRoleFit([userMsg("hi")]), null);
  });
});

// --- the mail draft -------------------------------------------------------

describe("mail draft", () => {
  test("condenses at a line boundary, never mid-sentence", () => {
    const body = ["one", "two", "three", "four"].join("\n");
    assert.equal(condense(body, 9), "one\ntwo");
    assert.equal(condense(body, 100), body);
  });

  test("a 10-turn assessment fits the mail ceiling", () => {
    const body = scorecardMarkdown(FIT, { sourceUrl: "https://sidhantmathur.com" });
    const href = mailtoHref({ subject: "Role fit", body });
    const decoded = decodeURIComponent(href.split("&body=")[1]);
    assert.ok(decoded.length <= MAILTO_MAX_BODY);
    assert.ok(!decoded.includes("**"), "markdown emphasis leaked into a plain-text mail body");
  });

  test("the permalink leads the body, so a truncated draft still reaches the full version", () => {
    const body = scorecardMarkdown(FIT, {
      sourceUrl: "https://sidhantmathur.com",
      permalink: "https://sidhantmathur.com/#c=abc",
    });
    assert.ok(body.indexOf("#c=abc") < body.indexOf(FIT.gaps[0]));
  });
});

// --- the conversation document -------------------------------------------

describe("markdown export", () => {
  test("a 10-turn conversation with a posting renders whole", () => {
    const md = conversationToMarkdown(tenTurnConversation(), {
      title: "Sidhant Mathur",
      sourceUrl: "https://sidhantmathur.com",
      footer: "AI-generated answers.",
      permalink: "https://sidhantmathur.com/#c=abc",
    });
    assert.match(md, /^# Sidhant Mathur/);
    assert.match(md, /#c=abc/);
    // Ten questions, quoted.
    assert.equal((md.match(/^> Question/gm) ?? []).length, 9);
    for (const gap of FIT.gaps) assert.ok(md.includes(gap), `gap dropped: ${gap}`);
    assert.ok(md.endsWith("\n") && !md.endsWith("\n\n"));
  });

  test("citation markers leave the prose and land in a sources line", () => {
    const md = conversationToMarkdown([assistantMsg("He did the thing [resume:nokia].")]);
    assert.ok(!md.includes("[resume:nokia]."));
    assert.match(md, /Sources: resume:nokia/);
  });
});

// --- the shell wiring -----------------------------------------------------
//
// Source-text assertions, the same technique the other static suites use for
// things no runtime boundary exposes. Coarse on purpose: each one guards a
// failure that is silent in the browser.

describe("shell wiring", () => {
  test("every slash command opens a panel view that exists", () => {
    const shellData = read("components/shell/shell-data.ts");
    const conversation = read("components/shell/use-conversation.ts");
    const kinds = new Set(
      [...conversation.matchAll(/\{ kind: "(\w+)"/g)].map((m) => m[1]),
    );
    const commands = [...shellData.matchAll(/panel: "(\w+)"/g)].map((m) => m[1]);
    assert.ok(commands.length >= 7, "the slash registry lost commands");
    for (const target of commands) {
      assert.ok(kinds.has(target), `/${target} points at a panel view that doesn't exist`);
    }
  });

  test("the three commands Sprint 5 owes are registered", () => {
    const shellData = read("components/shell/shell-data.ts");
    for (const name of ["/budget", "/sources", "/pdf"]) {
      assert.ok(shellData.includes(`"${name}"`), `${name} is not in the slash registry`);
    }
  });

  test("the panel URL keeps the fragment", () => {
    // pushState with a bare path drops the hash, which would erase the
    // conversation a reader is replaying the moment they opened a panel.
    const src = read("components/shell/use-panel-url.ts");
    assert.match(src, /function panelHref[\s\S]*?window\.location\.hash|hash: string/);
    assert.ok(
      src.includes("window.location.hash"),
      "usePanelUrl no longer reads the fragment before pushing a path",
    );
  });

  test("a replayed conversation is never written to local storage", () => {
    const src = read("components/shell/use-conversation.ts");
    assert.match(src, /if \(!hydrated \|\| replayed\) return;/);
  });

  test("print swaps the shell for the document rather than styling the app", () => {
    const css = read("app/globals.css");
    assert.match(css, /@media print/);
    assert.match(css, /\.screen-only\s*\{\s*display: none !important;/);
    assert.ok(read("components/shell/app-shell.tsx").includes("screen-only"));
    assert.ok(read("components/shell/print-sheet.tsx").includes("print-only"));
  });

  test("no dependency was added for the export surface", () => {
    // CLAUDE.md asks for any new dependency to be named and justified. The
    // answer for Sprint 5 is none: the browser prints, and CompressionStream
    // deflates. This asserts the answer stayed none.
    const pkg = JSON.parse(read("package.json"));
    for (const name of Object.keys(pkg.dependencies)) {
      assert.ok(
        !/pdf|docx|jspdf|html2canvas|lz-string|pako|file-saver/i.test(name),
        `an export dependency appeared: ${name}`,
      );
    }
  });
});
