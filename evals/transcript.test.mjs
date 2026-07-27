// Unit tests for lib/transcript.ts — the markdown serializer behind the
// copy-to-clipboard buttons.
//
// Run under `node --test --experimental-strip-types` (see the `eval` script in
// package.json); Node strips the types and runs the .ts directly, so there's no
// build step and no new dependency.
//
// The case that matters most is roleFit caveats: the whole point of copying an
// assessment is that a recruiter forwards it, and an assessment that drops its
// gaps on the way to the clipboard is worse than one that was never copied.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  conversationToMarkdown,
  messageToMarkdown,
  textOf,
  toolPartToMarkdown,
  toolPartsOf,
} from "../lib/transcript.ts";

const userMsg = (text) => ({ role: "user", parts: [{ type: "text", text }] });
const assistantMsg = (text, ...tools) => ({
  role: "assistant",
  parts: [{ type: "text", text }, ...tools],
});
const toolPart = (type, output) => ({ type, state: "output-available", output });

describe("textOf", () => {
  test("joins multiple text parts", () => {
    const m = { role: "assistant", parts: [{ type: "text", text: "a " }, { type: "text", text: "b" }] };
    assert.equal(textOf(m), "a b");
  });

  test("ignores non-text parts", () => {
    const m = { role: "assistant", parts: [{ type: "text", text: "hi" }, toolPart("tool-showResume", {})] };
    assert.equal(textOf(m), "hi");
  });
});

describe("toolPartsOf", () => {
  test("only returns completed tool parts", () => {
    const m = {
      role: "assistant",
      parts: [
        { type: "text", text: "hi" },
        { type: "tool-roleFit", state: "input-streaming" },
        toolPart("tool-showResume", { htmlHref: "/resume" }),
      ],
    };
    assert.equal(toolPartsOf(m).length, 1);
  });
});

describe("roleFit serialization", () => {
  const data = {
    role: "GTM engineer",
    matches: [
      { area: "Cross-functional ownership", evidence: "Owned the Power BI migration for 150+ users." },
      { area: "SQL and data modeling", evidence: "Built the transformation logic in SQL/DAX." },
    ],
    caveats: "He has not carried a quota or worked directly with external customers.",
  };

  test("renders role, matches, and caveats", () => {
    const md = toolPartToMarkdown(toolPart("tool-roleFit", data));
    assert.match(md, /\*\*Role fit — GTM engineer\*\*/);
    assert.match(md, /- \*\*Cross-functional ownership\*\* — Owned the Power BI migration/);
    assert.match(md, /Worth knowing: He has not carried a quota/);
  });

  test("caveats survive the trip to the clipboard", () => {
    // The regression this suite exists to prevent.
    const md = conversationToMarkdown([
      userMsg("Is he a fit for a GTM engineering role?"),
      assistantMsg("Here's how it maps.", toolPart("tool-roleFit", data)),
    ]);
    assert.ok(
      md.includes("has not carried a quota"),
      "roleFit caveats were dropped from the copied transcript",
    );
  });

  test("omits the caveats line when the model didn't provide one", () => {
    const md = toolPartToMarkdown(toolPart("tool-roleFit", { ...data, caveats: undefined }));
    assert.ok(!md.includes("Worth knowing:"));
  });

  test("survives a role with no matches", () => {
    const md = toolPartToMarkdown(toolPart("tool-roleFit", { role: "RevOps" }));
    assert.equal(md, "**Role fit — RevOps**");
  });
});

describe("other tools", () => {
  test("project card renders title, stack, and an absolute link", () => {
    const md = toolPartToMarkdown(
      toolPart("tool-showProject", {
        title: "A Darle 20",
        description: "A two-sided marketplace.",
        stack: ["Next.js", "Supabase"],
        caseStudyHref: "/projects/adarle20",
      }),
    );
    assert.match(md, /\*\*A Darle 20\*\*/);
    assert.match(md, /Stack: Next\.js, Supabase/);
    assert.match(md, /https:\/\/sidhantmathur\.com\/projects\/adarle20/);
  });

  test("resume card renders absolute links", () => {
    const md = toolPartToMarkdown(toolPart("tool-showResume", { htmlHref: "/resume", pdfHref: "/resume.pdf" }));
    assert.match(md, /https:\/\/sidhantmathur\.com\/resume$/m);
    assert.match(md, /https:\/\/sidhantmathur\.com\/resume\.pdf/);
  });

  test("contact card strips the mailto: scheme", () => {
    const md = toolPartToMarkdown(
      toolPart("tool-contactCard", { email: "mailto:hello@sidhantmathur.com", github: "https://github.com/x" }),
    );
    assert.match(md, /^hello@sidhantmathur\.com/);
    assert.ok(!md.includes("mailto:"));
  });

  test("unknown tools render nothing rather than throwing", () => {
    assert.equal(toolPartToMarkdown(toolPart("tool-somethingNew", { a: 1 })), null);
  });

  test("a null output renders nothing", () => {
    assert.equal(toolPartToMarkdown({ type: "tool-roleFit", state: "output-available", output: null }), null);
  });
});

describe("messageToMarkdown", () => {
  test("user turns become blockquotes", () => {
    assert.equal(messageToMarkdown(userMsg("What did he build at Nokia?")), "> What did he build at Nokia?");
  });

  test("multi-line user turns quote every line", () => {
    // The job-description paste is the real case here.
    const md = messageToMarkdown(userMsg("Line one\n\nLine three"));
    assert.equal(md, "> Line one\n>\n> Line three");
  });

  test("assistant prose passes through untouched", () => {
    assert.equal(messageToMarkdown(assistantMsg("He migrated reporting to **Power BI**.")), "He migrated reporting to **Power BI**.");
  });
});

describe("conversationToMarkdown", () => {
  const convo = [
    userMsg("What did he build at Nokia?"),
    assistantMsg("A self-serve Power App for 80+ stakeholders."),
    userMsg("And the marketplace?"),
    assistantMsg("A Darle 20 — 1,400+ users."),
  ];

  test("alternates quoted questions and plain answers", () => {
    const md = conversationToMarkdown(convo);
    assert.match(md, /> What did he build at Nokia\?\n\nA self-serve Power App/);
  });

  test("includes an optional title, source, and footer", () => {
    const md = conversationToMarkdown(convo, {
      title: "Chat transcript",
      sourceUrl: "https://sidhantmathur.com",
      footer: "AI-generated answers.",
    });
    assert.match(md, /^# Chat transcript/);
    assert.match(md, /https:\/\/sidhantmathur\.com/);
    assert.match(md, /---\n\nAI-generated answers\.\n$/);
  });

  test("skips messages with no renderable content", () => {
    const md = conversationToMarkdown([userMsg("hi"), { role: "assistant", parts: [{ type: "text", text: "" }] }]);
    assert.equal(md, "> hi\n");
  });

  test("an empty conversation produces no stray separators", () => {
    assert.equal(conversationToMarkdown([]), "\n");
  });

  test("output ends with exactly one newline", () => {
    const md = conversationToMarkdown(convo);
    assert.ok(md.endsWith("\n") && !md.endsWith("\n\n"));
  });
});
