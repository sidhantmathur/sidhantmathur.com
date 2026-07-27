// Unit tests for the Sprint 2 instruments — the cost arithmetic behind the
// meter (#1) and the two lists that the failure theatre (#6) depends on staying
// in step with the route.
//
// The drift these catch is the quiet kind. A model added to the allowlist with
// no price entry doesn't break anything: the meter just renders "—" and the
// session total silently stops counting that model's turns, which is worse than
// an error because it still looks like a working instrument. Same shape of
// problem for an error class that exists in the vocabulary but has no button
// and no server case — failure theatre would claim to show "every way this site
// can fail" while quietly omitting one.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { MODEL_PRICES, costOfTurn, formatUsd, sumCosts } from "../lib/pricing.ts";
import {
  readErrorClasses,
  readFailureTheatreClasses,
  readServerModels,
  readSimulatableClasses,
} from "./lib/artifacts.mjs";

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
    for (const id of Object.keys(readServerModels())) {
      assert.ok(
        MODEL_PRICES[id],
        `"${id}" is on the server allowlist but has no entry in lib/pricing.ts — the cost meter would silently drop its turns`,
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

describe("failure theatre covers the whole error vocabulary", () => {
  test("every error class can be simulated by the route", () => {
    const simulatable = readSimulatableClasses();
    for (const cls of readErrorClasses()) {
      assert.ok(
        simulatable.includes(cls),
        `"${cls}" is a telemetry error class with no case in the route's SIMULATABLE list`,
      );
    }
  });

  test("every error class has a button in the panel", () => {
    const offered = readFailureTheatreClasses();
    for (const cls of readErrorClasses()) {
      assert.ok(
        offered.includes(cls),
        `"${cls}" is a telemetry error class with no entry in the failure-theatre list`,
      );
    }
  });

  test("the panel offers nothing the route won't produce", () => {
    const simulatable = readSimulatableClasses();
    for (const cls of readFailureTheatreClasses()) {
      assert.ok(simulatable.includes(cls), `the panel offers "${cls}" but the route ignores it`);
    }
  });
});
