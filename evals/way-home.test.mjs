// Regression tests for the way out of a conversation (2026-10-19).
//
// The bugs: a stored conversation was put back on screen by every load, so a
// reload never showed the front page again; the name in the header linked to
// "/", the page the visitor was already on, so it did nothing from inside a
// conversation; Back left the site, because a conversation had no history entry
// of its own; and the only way out was "reset", a faint word in the bottom
// corner that deleted the conversation. Two quieter ones came out of the same
// pass: a conversation saved mid-answer came back as a question with nothing
// under it and no way to ask again, and the per-conversation cap answered with
// the hourly budget's "wait" state, for something a new conversation fixes.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { MAX_USER_MESSAGES } from "../lib/models.ts";
import { TURN_FAILURES, isRetryableClass } from "../lib/chat-telemetry.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const flat = (path) => read(path).replace(/\s+/g, " ");

const hook = flat("components/shell/use-conversation.ts");
// The shell was one file until the 2026-11-02 split (docs/app-shell-split.md).
// AppShell keeps the wiring; each region is its own file beside it.
const shell = flat("components/shell/app-shell.tsx");
const statusStrip = flat("components/shell/status-strip.tsx");
const conversationBar = flat("components/shell/conversation-bar.tsx");
const frontDoor = flat("components/shell/front-door.tsx");
const transcript = flat("components/shell/transcript-view.tsx");
const allShell = readdirSync(new URL("../components/shell/", import.meta.url))
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => flat(`components/shell/${f}`))
  .join(" ");
const history = flat("components/shell/conversation-history.ts");

describe("a reload lands on the front door", () => {
  test("a stored conversation is offered, not put back on screen", () => {
    // The only path that shows a stored conversation on load is coming back
    // with Back from another page of the site, where the entry says "chat".
    assert.match(hook, /if \(returning && isChatEntry\(\) && stored\.length\) \{ show\(stored\);/);
    assert.match(hook, /if \(stored\.length\) setSaved\(\{ messages: stored, replayed: false \}\);/);
  });

  test("an entry that said chat before the reload is relabelled", () => {
    assert.match(hook, /if \(isChatEntry\(\)\) markEntry\("home"\);/);
  });
});

describe("leaving keeps the conversation", () => {
  test("only clearing it removes it from storage", () => {
    const removals = hook.match(/removeItem\(STORAGE_KEY\)/g) ?? [];
    assert.equal(removals.length, 1, "something besides clearSaved deletes the stored conversation");
    const clear = hook.slice(hook.indexOf("function clearSaved()"));
    assert.ok(
      clear.indexOf("removeItem(STORAGE_KEY)") > -1 &&
        clear.indexOf("removeItem(STORAGE_KEY)") < clear.indexOf("return {"),
      "the one removal is not in clearSaved",
    );
  });

  test("leave saves what was on screen before clearing it", () => {
    const leave = hook.slice(hook.indexOf("const leave = useCallback"));
    const save = leave.indexOf("setSaved({ messages, replayed })");
    const clear = leave.indexOf("setMessages([])");
    assert.ok(save > -1 && clear > -1 && save < clear);
  });
});

describe("the way out is visible", () => {
  test("the name goes to the front door rather than linking to the same page", () => {
    assert.match(statusStrip, /<Link href="\/" onClick=\{\(e\) => \{[^}]*e\.preventDefault\(\); onHome\(\);/);
    const strip = shell.slice(shell.indexOf("<StatusStrip"));
    assert.ok(strip.slice(0, strip.indexOf("/>")).includes("onHome={goHome}"), "the header's name isn't wired to goHome");
  });

  test("a conversation has a labelled Home button at the top", () => {
    const bar = conversationBar.slice(conversationBar.indexOf("Conversation bar"));
    assert.ok(bar.indexOf("onClick={onHome}") > -1, "the conversation bar has no Home button");
    assert.ok(bar.indexOf("{HOME_LABEL}") > -1, "the Home button has no visible label");
    assert.match(shell, /\{hasMessages && <ConversationBar onHome=\{goHome\}/);
  });

  test("the strip no longer carries reset", () => {
    assert.doesNotMatch(allShell, /label="reset"/);
  });

  test("the front door offers the saved conversation and a way to clear it", () => {
    assert.match(shell, /\{!hasMessages && saved && \(/);
    assert.match(shell, /onContinue=\{continueSaved\}/);
    assert.match(shell, /onClear=\{clearSaved\}/);
    assert.match(frontDoor, /onClick=\{onContinue\}/);
    assert.match(frontDoor, /onClick=\{onClear\}/);
  });
});

describe("Back moves across the front door", () => {
  test("the first question from the front door gets its own entry", () => {
    assert.match(shell, /function ask\(text: string\) \{ if \(!messages\.length\) pushChatEntry\(\);/);
  });

  test("every way of asking goes through ask", () => {
    // A direct submit would start a conversation with no entry behind it, and
    // Back from it would leave the site again.
    const direct = allShell.match(/(?<![.\w])submit\(/g) ?? [];
    assert.equal(direct.length, 1, "submit is called somewhere other than ask");
  });

  test("a panel opened inside a conversation stays inside it", () => {
    assert.match(read("components/shell/use-panel-url.ts"), /pushState\(carriedState\(\), "", target\)/);
  });

  test("popstate leaves or resumes by the entry's marker", () => {
    assert.match(history, /if \(inConversation && !chat\) leave\(\); else if \(!inConversation && chat && canResume\) resume\(\);/);
  });
});

describe("a conversation that stopped short says so", () => {
  test("the class is a client one, retryable, with its own sentence", () => {
    const spec = TURN_FAILURES.interrupted;
    assert.equal(spec.origin, "client");
    assert.equal(spec.simulatable, false);
    assert.ok(isRetryableClass("interrupted"), "a stopped-short question with no retry is the dead end this fixes");
    assert.ok(spec.copy && spec.copy.length > 40);
  });

  test("a cut-off answer is read off the turn record's missing closing write", () => {
    assert.match(hook, /return turn != null && turn\.data\.usage == null && turn\.data\.error == null;/);
  });
});

describe("the conversation cap is not the hourly budget", () => {
  test("the cap is enforced before the request", () => {
    assert.match(hook, /const full = userTurns\(messages\) >= MAX_USER_MESSAGES;/);
    assert.match(hook, /if \(!q \|\| isBusy \|\| full\) return;/);
  });

  test("the full state names the cap the route enforces", () => {
    assert.match(transcript, /That's \$\{MAX_USER_MESSAGES\} questions/);
    assert.ok(MAX_USER_MESSAGES > 0);
    assert.match(transcript, /\{full && !isBusy && \(/);
  });
});
