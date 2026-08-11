// Unit tests for the Sprint 2 instruments — the cost arithmetic behind the
// meter (#1) and the failure vocabulary the theatre (#6) renders.
//
// The drift these catch is the quiet kind. A model added to the allowlist with
// no price entry doesn't break anything: the meter just renders "—" and the
// session total silently stops counting that model's turns, which is worse than
// an error because it still looks like a working instrument.
//
// The failure half used to catch the same shape of problem by comparing three
// hand-kept lists. They are one table now, so the checks here are about what is
// IN it — a class with no sentence of its own borrows the generic one silently,
// which is the same kind of instrument that looks like it works.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  MODEL_PRICES,
  PRICE_CONFIDENCE,
  costOfTurn,
  formatUsd,
  sumCosts,
} from "../lib/pricing.ts";
import { MODEL_IDS } from "../lib/models.ts";
import {
  SIMULATABLE_CLASSES,
  TURN_ERROR_CLASSES,
  TURN_FAILURES,
  isRateLimitClass,
  isSilentClass,
  toTurnErrorClass,
  turnErrorCopy,
  turnErrorLabel,
} from "../lib/chat-telemetry.ts";

describe("cost arithmetic", () => {
  const usage = {
    inputTokens: 10_000,
    cachedInputTokens: 8_000,
    cacheWriteTokens: 0,
    outputTokens: 500,
  };

  test("prices a turn at list price, splitting fresh input from cache reads", () => {
    // haiku 4.5: $1.00 input, $5.00 output, $0.10 cache read, per 1M tokens.
    const cost = costOfTurn("anthropic/claude-haiku-4.5", usage);
    assert.ok(cost);
    // 2,000 fresh input tokens at $1/1M.
    assert.equal(cost.freshInput.toFixed(6), (0.002).toFixed(6));
    // 8,000 cache reads at $0.10/1M.
    assert.equal(cost.cacheRead.toFixed(6), (0.0008).toFixed(6));
    // 500 output tokens at $5/1M.
    assert.equal(cost.output.toFixed(6), (0.0025).toFixed(6));
    assert.equal(cost.total.toFixed(6), (0.002 + 0.0008 + 0.0025).toFixed(6));
  });

  test("the cache saving is what those tokens would have cost fresh", () => {
    const cost = costOfTurn("anthropic/claude-haiku-4.5", usage);
    // 8,000 tokens at $1/1M instead of $0.10/1M.
    assert.equal(cost.saved.toFixed(6), (0.008 - 0.0008).toFixed(6));
  });

  test("cached tokens are never double-counted as fresh input", () => {
    // The whole point of the split: a provider reporting a fully-cached prompt
    // must not be billed as if none of it were cached.
    const cost = costOfTurn("anthropic/claude-haiku-4.5", {
      inputTokens: 8_000,
      cachedInputTokens: 8_000,
      cacheWriteTokens: 0,
      outputTokens: 0,
    });
    assert.equal(cost.freshInput, 0);
  });

  test("an unpriced model returns null rather than a guess", () => {
    assert.equal(costOfTurn("someone/unreleased-model", usage), null);
  });

  test("summing skips unpriced turns instead of counting them as free", () => {
    const priced = costOfTurn("anthropic/claude-haiku-4.5", usage);
    const summed = sumCosts([priced, null, priced]);
    assert.equal(summed.total.toFixed(6), (priced.total * 2).toFixed(6));
  });

  test("a turn with no usage costs zero, not NaN", () => {
    const cost = costOfTurn("anthropic/claude-haiku-4.5", null);
    assert.equal(cost.total, 0);
    assert.equal(formatUsd(cost.total), "$0.0000");
  });

  test("four decimals, because a turn here costs a fraction of a cent", () => {
    // Two decimals would render every honest number as $0.00, which reads as
    // "not measured" rather than "very cheap".
    assert.equal(formatUsd(0.00317), "$0.0032");
  });
});

describe("the price table covers what the site can actually run", () => {
  test("every allowlisted model has a list price", () => {
    // The allowlist and the price table are two views of one catalogue now, so
    // this can only fail if a row loses its price fields — but that is exactly
    // the failure that would make the cost meter silently drop a model's turns.
    for (const id of MODEL_IDS) {
      assert.ok(
        MODEL_PRICES[id],
        `"${id}" is in the catalogue but has no price — the cost meter would silently drop its turns`,
      );
    }
  });

  test("every model says how far its prices are to be trusted", () => {
    // /measurements/models prints these figures and labels each one with its
    // confidence. A row with no confidence would render an unqualified number.
    for (const id of MODEL_IDS) {
      assert.ok(
        ["confirmed", "derived", "unconfirmed"].includes(PRICE_CONFIDENCE[id]),
        `"${id}" has no price confidence — the page would print a dollar figure with no caveat`,
      );
    }
  });

  test("no price is zero or negative", () => {
    for (const [id, price] of Object.entries(MODEL_PRICES)) {
      assert.ok(price.input > 0, `${id} has a non-positive input price`);
      assert.ok(price.output > 0, `${id} has a non-positive output price`);
      assert.ok(price.cacheRead >= 0, `${id} has a negative cache-read price`);
      assert.ok(price.cacheWrite >= 0, `${id} has a negative cache-write price`);
    }
  });

  test("a cache read never costs more than fresh input", () => {
    // If it did, the "saved by the cache" line would render a negative saving,
    // and the argument the meter exists to make would be backwards.
    for (const [id, price] of Object.entries(MODEL_PRICES)) {
      assert.ok(price.cacheRead <= price.input, `${id} prices a cache read above fresh input`);
    }
  });
});

// The route's simulate list and the failure-theatre deck are both derived from
// TURN_FAILURES now, so asserting that they agree with it would be asserting a
// tautology. What is still worth checking is the table's CONTENT: that every
// class carries the things the UI reads off it, and that the one client-only
// class is described as one everywhere it matters.
describe("the failure table describes every class it declares", () => {
  test("every class resolves to a sentence and a label", () => {
    for (const cls of TURN_ERROR_CLASSES) {
      assert.ok(turnErrorCopy(cls).length > 0, `"${cls}" resolves to an empty sentence`);
      assert.ok(turnErrorLabel(cls).length > 0, `"${cls}" resolves to an empty label`);
    }
  });

  test("the two classes with no sentence of their own are the two that render none", () => {
    // `rate_limited` routes to ManualMode and `aborted` renders nothing at all.
    // Any OTHER class falling through to the generic sentence is a class that
    // was added without anyone writing copy for it.
    for (const cls of TURN_ERROR_CLASSES) {
      if (TURN_FAILURES[cls].copy != null) continue;
      assert.ok(
        isRateLimitClass(cls) || isSilentClass(cls),
        `"${cls}" has no sentence of its own and would silently borrow the generic one`,
      );
    }
  });

  test("every class the route can simulate says how it reaches the client", () => {
    for (const cls of SIMULATABLE_CLASSES) {
      const spec = TURN_FAILURES[cls];
      assert.equal(spec.origin, "server", `"${cls}" is simulatable but is not a server failure`);
      assert.ok(spec.wire, `"${cls}" has a button in the deck but no wire description`);
      assert.ok(spec.cause, `"${cls}" has a button in the deck but no cause description`);
    }
  });

  test("a client-only class is never offered as something the route can produce", () => {
    // `network` is raised in the browser's fetch wrapper — the request never
    // reaches the route, so the route has no exit to take and the deck has no
    // button to offer. This is the assertion the old scraper got backwards: it
    // demanded EVERY class appear in the route's list, which a class the server
    // never emits cannot.
    for (const cls of TURN_ERROR_CLASSES) {
      if (TURN_FAILURES[cls].origin !== "client") continue;
      assert.ok(
        !SIMULATABLE_CLASSES.includes(cls),
        `"${cls}" is client-only but the route offers to simulate it`,
      );
      assert.equal(TURN_FAILURES[cls].wire, null, `client-only "${cls}" describes a server exit`);
    }
  });

  test("an early exit's simulated status is a real error status", () => {
    for (const cls of TURN_ERROR_CLASSES) {
      const status = TURN_FAILURES[cls].simulateStatus;
      if (status == null) continue;
      assert.ok(status >= 400 && status < 600, `"${cls}" simulates a non-error status ${status}`);
      assert.ok(
        TURN_FAILURES[cls].simulatable,
        `"${cls}" has a simulated status but is not simulatable`,
      );
    }
  });

  test("an unrecognised value narrows to unknown, and every real one to itself", () => {
    for (const cls of TURN_ERROR_CLASSES) assert.equal(toTurnErrorClass(cls), cls);
    assert.equal(toTurnErrorClass("teapot"), "unknown");
    assert.equal(toTurnErrorClass(undefined), "unknown");
    assert.equal(toTurnErrorClass("toString"), "unknown");
  });
});
