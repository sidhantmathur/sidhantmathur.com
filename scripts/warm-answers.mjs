// Asks each suggested question once after a deploy, so the first recruiter to
// click a chip gets the stored answer instead of the wait.
//
// Stored answers are keyed by deployment (lib/stored-answers.ts), so every
// deploy starts empty. A generated answer is only kept if it passes the
// citation check, so a question is asked again until the reply comes back
// stored, up to MAX_TRIES.
//
// Usage:
//   BASE=https://sidhantmathur.com npm run warm
//
// Each attempt is a real turn: it spends the hourly budget of the IP running
// this, and a generation bills the Gateway. Three chips at up to four tries
// each stays inside one hour's budget of 20.

import { SUGGESTED_QUESTIONS } from "../content/recruiter.ts";

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const MAX_TRIES = 4;

/** One turn. Resolves with whether it was replayed from the store. */
async function ask(question) {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ id: "warm", role: "user", parts: [{ type: "text", text: question }] }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => "")}`);
  // Drained, because the route only decides whether to keep an answer once the
  // turn has finished streaming.
  await res.text();
  return { stored: res.headers.has("x-stored-answer"), ms: Date.now() - started };
}

let failed = false;
for (const question of SUGGESTED_QUESTIONS) {
  let done = false;
  let broke = false;
  for (let attempt = 1; attempt <= MAX_TRIES && !done && !broke; attempt += 1) {
    try {
      const { stored, ms } = await ask(question);
      if (stored) {
        console.log(`  ✓ "${question}" is stored (${ms} ms)`);
        done = true;
      } else {
        console.log(`  · "${question}" generated in ${ms} ms, attempt ${attempt}`);
        // The answer is written after the response; give the store a moment.
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      // A 429 is this IP's hourly budget, which replays spend too.
      console.log(`  ✗ "${question}": ${err.message}`);
      broke = true;
    }
  }
  if (!done) failed = true;
  if (!done && !broke) {
    console.log(`  ✗ "${question}" isn't stored. The server log says why ("stored answer not kept").`);
  }
}
process.exit(failed ? 1 : 0);
