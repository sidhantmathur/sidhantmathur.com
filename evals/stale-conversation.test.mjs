// Regression tests for the returning-visitor crash.
//
// The bug: Sprint 4 changed the shape of a roleFit tool result, and a
// conversation persisted before that came back out of local storage with no
// `counts`. Reading one off it threw during render, and a throw during render
// takes down the whole shell rather than the panel — so a visitor who had asked
// about a job posting the week before opened the site to a blank page, with no
// affordance to recover but clearing their own browser storage.
//
// Nothing caught it because both halves looked fine in isolation: the writer
// stored what it had, the reader read what it was given, and no test ever put a
// last-version payload in front of a this-version renderer.
//
// The fix is in two places and both are asserted here, because either alone
// leaves a door open. The version bump retires stored conversations that can no
// longer be rendered; the guard in the renderer covers a permalink, which
// carries the same object inside a URL and never touches storage at all.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const conversation = readFileSync(
  new URL("../components/shell/use-conversation.ts", import.meta.url),
  "utf8",
);
const panel = readFileSync(
  new URL("../components/shell/panel-body.tsx", import.meta.url),
  "utf8",
);

describe("stored conversations are versioned", () => {
  test("the storage key carries a version", () => {
    const key = conversation.match(/const STORAGE_KEY = "([^"]+)"/)?.[1];
    assert.ok(key, "STORAGE_KEY should be a plain string literal so this test can read it");
    assert.match(key, /\.v\d+$/, "the storage key should end in a version");
  });

  test("the pre-Sprint-4 key is retired rather than left in the attic", () => {
    const retired = conversation.match(/const RETIRED_STORAGE_KEYS = \[([^\]]*)\]/)?.[1];
    assert.ok(retired, "RETIRED_STORAGE_KEYS should exist");
    assert.match(retired, /"conversation\.v1"/, "v1 held the payloads that crash the table");
  });

  test("the current key is not also listed as retired", () => {
    const key = conversation.match(/const STORAGE_KEY = "([^"]+)"/)?.[1];
    const retired = conversation.match(/const RETIRED_STORAGE_KEYS = \[([^\]]*)\]/)?.[1] ?? "";
    assert.ok(
      !retired.includes(`"${key}"`),
      "retiring the current key would wipe every conversation on load",
    );
  });

  test("restoring removes every retired key", () => {
    assert.match(
      conversation,
      /for \(const key of RETIRED_STORAGE_KEYS\) window\.localStorage\.removeItem\(key\)/,
      "the retired keys should be cleared on restore, not merely ignored",
    );
  });
});

describe("the requirement table survives a payload it doesn't recognise", () => {
  test("it guards before it destructures", () => {
    const guard = panel.indexOf("if (!Array.isArray(partial.rows)");
    const destructure = panel.indexOf("} = partial as RoleFit");
    assert.ok(guard > -1, "the shape guard should exist");
    assert.ok(destructure > -1, "the narrowed destructure should exist");
    assert.ok(
      guard < destructure,
      "destructuring a complete RoleFit before checking the shape is the original bug",
    );
  });

  test("it accepts a fit that may be undefined", () => {
    assert.match(
      panel,
      /fit: RoleFit \| undefined/,
      "typing the prop as always-present is what let an unchecked payload in",
    );
  });

  test("an unreadable assessment says so rather than rendering empty", () => {
    const copy = panel.match(/const ROLE_FIT_UNREADABLE =\s*\n?\s*"([^"]+)"/)?.[1];
    assert.ok(copy, "there should be a string for the unreadable case");
    assert.ok(copy.length > 40, "a bare label doesn't tell the reader what to do next");
    assert.match(copy, /paste the posting again/i, "it should name the way out");
  });

  test("the guard covers all three fields the render reads off the object", () => {
    // counts is indexed, rows and gaps are mapped. Any one of them missing is a
    // throw, so checking only the one that happened to break is not a fix.
    const guard = panel.match(/if \(!Array\.isArray\(partial\.rows\)[^)]*\)[^{]*\{/s)?.[0] ?? "";
    for (const field of ["rows", "counts", "gaps"]) {
      assert.ok(guard.includes(`partial.${field}`), `the guard should check ${field}`);
    }
  });
});
