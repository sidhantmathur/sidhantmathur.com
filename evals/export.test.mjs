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
import { JD_PREFIX } from "../lib/job-posting.ts";
import {
  INTERNAL_TOOL_PARTS,
  MAILTO_MAX_BODY,
  SNAPSHOT_VERSION,
  condense,
  conversationToMarkdown,
  fitSnapshot,
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
  fitPermalinkFor,
  payloadFromHash,
  permalinkFor,
} from "../lib/permalink.ts";
import {
  PANELS,
  PANEL_BY_PATH,
  PANEL_KINDS,
  SLASH_PANELS,
  isPlainPanelKind,
} from "../components/shell/panels.ts";

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

/** What the extraction step returns: the posting's requirements, verbatim. */
const EXTRACTION = {
  role: "GTM engineer",
  requirements: FIT.rows.map((r) => r.requirement),
};

/**
 * The largest conversation the site can produce: 10 user turns, one a posting.
 * The posting turn's answer carries both steps, as a real one does — the
 * extraction and then the assessment.
 */
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
      toolPart("tool-extractRequirements", EXTRACTION),
      toolPart("tool-roleFit", FIT),
    ),
  );
  return messages;
}

/**
 * One real fit check, recorded through the site against a 3,891-character
 * posting (evals/fixtures/recorded-fit-check.json). The synthetic fixture above
 * is shaped to exercise every code path; this one is here so the length
 * assertions measure a table a model actually wrote.
 */
const RECORDED = JSON.parse(read("evals/fixtures/recorded-fit-check.json")).messages;

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

  test("a conversation carrying a posting round-trips its assessment exactly, without the posting", async () => {
    // The posting never travels (lib/transcript.ts): the reader a fit check is
    // sent to already has it, and the table quotes every requirement it
    // judged. Everything that renders survives; the posting turn replays as
    // the paste panel's request line.
    const messages = tenTurnConversation();
    const link = await permalinkFor("https://sidhantmathur.com/", messages);
    const back = await decodeSnapshot(payloadFromHash(link.slice(link.indexOf("#"))));
    assert.equal(back.length, messages.length);
    assert.deepEqual(latestRoleFit(back), FIT);
    assert.equal(back[18].parts[0].text, JD_PREFIX);
    assert.equal(back[19].parts[0].text, "Here is how the posting maps onto the record [resume:nokia].");
  });

  test("the extraction step never travels — it renders nowhere and every line of it is a row", () => {
    const snap = toSnapshot(tenTurnConversation());
    const types = snap.m.flatMap((m) => (m.p ?? []).map((p) => p.y));
    assert.ok(types.includes("tool-roleFit"));
    assert.ok(!types.includes("tool-extractRequirements"));
  });

  test("the snapshot's internal-tool list agrees with the transport's", () => {
    // A local copy, like CITATION_MARKER: lib/transcript.ts stays free of the
    // transport's imports, so the two lists are held equal here instead.
    const transport = read("lib/chat-transport.ts");
    const declared = transport.match(/INTERNAL_TOOLS[^=]*=\s*new Set\(\[([^\]]*)\]\)/);
    assert.ok(declared, "INTERNAL_TOOLS is no longer declared as a literal set");
    const names = [...declared[1].matchAll(/"([^"]+)"/g)].map((m) => `tool-${m[1]}`);
    assert.deepEqual([...INTERNAL_TOOL_PARTS].sort(), names.sort());
  });

  test("a question that produced an assessment keeps its question", () => {
    // Only a turn the route treated as a posting — the extraction step ran —
    // is blanked. "Is he a fit for an SE role?" is not a posting.
    const q = "Would he be a fit for a solutions engineer role?";
    const snap = toSnapshot([userMsg(q), assistantMsg("Partly.", toolPart("tool-roleFit", FIT))]);
    assert.equal(snap.m[0].t, q);
  });

  test("a real fit check: the posting was a quarter of the link, the table is the rest", async () => {
    // Measured, not estimated. The full link is still past the safe length —
    // that is the point of the short link below — but leaving the posting out
    // takes a real one from ~4,500 characters to ~3,300.
    const link = await permalinkFor("https://sidhantmathur.com/", RECORDED);
    const posting = RECORDED[0].parts[0].text;
    const withPosting = `https://sidhantmathur.com/#c=${await encodeSnapshot({
      v: SNAPSHOT_VERSION,
      m: [{ r: "u", t: posting }, ...toSnapshot(RECORDED).m.slice(1)],
    })}`;
    assert.ok(posting.length > 3800, "the recorded posting is no longer a near-cap one");
    assert.ok(
      withPosting.length - link.length > 1000,
      `leaving the posting out saved only ${withPosting.length - link.length} characters`,
    );
    const back = await decodeSnapshot(payloadFromHash(link.slice(link.indexOf("#"))));
    assert.equal(latestRoleFit(back).rows.length, latestRoleFit(RECORDED).rows.length);
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

  test("payloadFromHash ignores a query pasted onto the end of the fragment", () => {
    // base64url has no `?` or `&`, so anything from one on was appended —
    // most likely `?ref=` added to a copied permalink (application links).
    assert.equal(payloadFromHash("#c=abc?ref=acme"), "abc");
    assert.equal(payloadFromHash("#c=abc&ref=acme"), "abc");
    assert.equal(payloadFromHash("#c=?ref=acme"), null);
  });
});

// --- the short fit link (application links) ---------------------------------

describe("short fit link", () => {
  test("carries the scorecard: its rows in the posting's order, the whole table's counts, every gap", () => {
    const snap = fitSnapshot(tenTurnConversation());
    assert.equal(snap.m.length, 2, "the request and the answer, nothing else");
    assert.equal(snap.m[0].r, "u");
    assert.equal(snap.m[0].t, JD_PREFIX, "the posting stays out of this link too");
    const fit = snap.m[1].p[0].o;
    // The scorecard's rule: cited rows with evidence, at most three. In this
    // fixture that is the met and the partial row, in table order.
    assert.deepEqual(
      fit.rows.map((r) => r.requirement),
      ["3+ years in revenue or sales operations", "SQL against a warehouse"],
    );
    assert.deepEqual(fit.counts, FIT.counts, "the counts must stay the whole table's");
    assert.deepEqual(fit.gaps, FIT.gaps, "every gap travels");
    assert.equal(fit.verdict, FIT.verdict);
    assert.equal(snap.m[1].t, "Here is how the posting maps onto the record [resume:nokia].");
  });

  test("an excerpt is detectable from the payload alone — more verdicts counted than rows present", () => {
    // That inequality is how the replayed table knows to say it is an excerpt
    // (panel-body.tsx, print-sheet.tsx). A full table never satisfies it.
    const fit = fitSnapshot(tenTurnConversation()).m[1].p[0].o;
    const total = Object.values(fit.counts).reduce((a, b) => a + b, 0);
    assert.ok(total > fit.rows.length);
    assert.equal(Object.values(FIT.counts).reduce((a, b) => a + b, 0), FIT.rows.length);
    const panel = read("components/shell/panel-body.tsx");
    assert.match(panel, /total > rows\.length && \(/);
    assert.match(read("components/shell/print-sheet.tsx"), /total > fit\.rows\.length/);
  });

  test("a real fit check's short link, ref included, fits where the full one doesn't", async () => {
    const ref = "?ref=a-forty-character-company-slug-123456";
    const full = await permalinkFor(`https://sidhantmathur.com/${ref}`, RECORDED);
    const short = await fitPermalinkFor(`https://sidhantmathur.com/${ref}`, RECORDED);
    assert.ok(full.length > PERMALINK_SAFE_CHARS, "the full link got short enough to retire the short one");
    assert.ok(
      short.length < PERMALINK_SAFE_CHARS,
      `the short fit link is ${short.length} characters`,
    );
    const back = await decodeSnapshot(payloadFromHash(short.slice(short.indexOf("#"))));
    const fit = latestRoleFit(back);
    assert.deepEqual(fit.gaps, latestRoleFit(RECORDED).gaps);
    assert.ok(fit.rows.length > 0 && fit.rows.length <= 3);
  });

  test("no fit check, no short link", async () => {
    assert.equal(fitSnapshot([userMsg("Hi"), assistantMsg("Hello.")]), null);
    assert.equal(await fitPermalinkFor("https://sidhantmathur.com/", []), null);
  });

  test("a question-shaped assessment keeps its question in the short link too", () => {
    const q = "Would he be a fit for a solutions engineer role?";
    const snap = fitSnapshot([userMsg(q), assistantMsg("Partly.", toolPart("tool-roleFit", FIT))]);
    assert.equal(snap.m[0].t, q);
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
  // These used to scrape `panel: "(\w+)"` out of shell-data.ts and check it
  // against `{ kind: "(\w+)"` scraped out of use-conversation.ts — two regexes
  // asserting that two hand-kept copies of the panel list still agreed. There
  // is one list now (components/shell/panels.ts), so agreement is a tautology
  // and what's left to check is the table's own content.

  test("every slash command names a panel in the registry", () => {
    assert.ok(SLASH_PANELS.length >= 7, "the slash registry lost commands");
    for (const cmd of SLASH_PANELS) {
      assert.ok(cmd.name.startsWith("/"), `${cmd.name} is not a slash command`);
      assert.ok(cmd.hint.trim(), `${cmd.name} has no hint`);
      assert.ok(PANELS[cmd.panel], `${cmd.name} points at a panel that doesn't exist`);
      assert.ok(
        isPlainPanelKind(cmd.panel),
        `${cmd.name} opens "${cmd.panel}", which needs a payload a slash command can't supply`,
      );
    }
    const names = SLASH_PANELS.map((c) => c.name);
    assert.equal(new Set(names).size, names.length, "two commands share a name");
  });

  test("the three commands Sprint 5 owes are registered", () => {
    const names = new Set(SLASH_PANELS.map((c) => c.name));
    for (const name of ["/budget", "/sources", "/pdf"]) {
      assert.ok(names.has(name), `${name} is not in the slash registry`);
    }
  });

  test("every panel that has a path has a unique, absolute one", () => {
    const paths = PANEL_KINDS.map((k) => PANELS[k].path).filter(Boolean);
    assert.ok(paths.length > 0, "no panel has an address any more");
    for (const path of paths) {
      assert.ok(path.startsWith("/"), `"${path}" is not an absolute path`);
    }
    assert.equal(new Set(paths).size, paths.length, "two panels claim the same path");
    // The inverse lookup usePanelUrl reads on popstate has to round-trip.
    for (const kind of PANEL_KINDS) {
      const path = PANELS[kind].path;
      if (path) assert.equal(PANEL_BY_PATH[path], kind, `${path} doesn't map back to ${kind}`);
    }
  });

  test("every panel opened by a tool names a tool the route defines", () => {
    const route = read("app/api/chat/route.ts");
    const defined = new Set(
      [...route.matchAll(/^\s{4}(\w+): tool\(\{/gm)].map((m) => `tool-${m[1]}`),
    );
    assert.ok(defined.size >= 4, "the tool scrape found nothing — the route moved");
    const wired = PANEL_KINDS.map((k) => PANELS[k].fromTool).filter(Boolean);
    assert.ok(wired.length > 0, "no panel opens from a tool any more");
    for (const tool of wired) {
      assert.ok(defined.has(tool), `a panel opens from ${tool}, which the route doesn't define`);
    }
    assert.equal(new Set(wired).size, wired.length, "two panels claim the same tool");
  });

  test("only the two panels that build a payload open from a tool", () => {
    // panelForTool constructs `{ kind }` for anything else, so a payload-
    // carrying kind wired to a tool without a branch there would open a panel
    // missing the data it renders.
    for (const kind of PANEL_KINDS) {
      if (!PANELS[kind].fromTool || isPlainPanelKind(kind)) continue;
      assert.ok(
        kind === "project" || kind === "roleFit",
        `"${kind}" needs a payload and opens from a tool, but panelForTool can't build one`,
      );
    }
  });

  test("every panel that renders has a title", () => {
    for (const kind of PANEL_KINDS) {
      // `none` is the closed panel — there is no title bar to fill.
      if (kind === "none") continue;
      assert.ok(PANELS[kind].title.trim(), `panel "${kind}" has no title`);
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
    // And the query, for the same reason: an application link's `?ref=` is
    // who sent the link, and a replayed fit check opens its panel on load.
    assert.match(src, /function panelHref\(panel: PanelView, hash: string, search = ""\)/);
    assert.ok(
      src.includes("window.location.search"),
      "usePanelUrl no longer reads the query before pushing a path",
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
