export const dynamic = "force-static";

const CONTENTS = `# Sidhant Mathur

I'm a sales operations specialist at Nokia, based in Toronto, with 5 years at
the company. I build and run the tools a 7-region sales organization reports
on, and I inherit and keep alive the ones other people built. I'm also the
co-founder and sole developer of A Darle 20, a marketplace with 2,100+ users,
part-time. I'm looking for a RevOps, sales operations or delivery operations
role.

At Nokia I built the weekly operating review tool that regional sales ops teams
use to compile the Chief Customer Officer's weekly report, and launched the
self-serve Power App behind quarter-end executive reporting for 80+
stakeholders across 7 regions. I run the sales incentive calculations for 900+
staff. Before that I ran the monthly headcount forecast process for a
3,000–4,000-person organization.

## Pages

/ — Home: background, selected work, and a chat assistant that answers
questions about my work.
/projects/nokia — Reporting and tooling at Nokia: the tools a 7-region sales
organization reports on.
/projects/adarle20 — A Darle 20: a marketplace for tabletop game sessions,
based in Puebla, Mexico.
/projects/dell-ml — Sales prediction model at Dell: a cross-sell propensity
model, built as an intern.
/resume — Resume, with a plain-text version at /resume.md.
/colophon — How this site was built.
/prompt — The full system prompt the site's assistant runs on.
/refusals — What the assistant will not do, and which of those rules are
enforced by code rather than asked of the model.
/measurements — What the assistant scores against a fixed eval corpus.
/measurements/models — The five models this site's chat offers, compared on one corpus: pass rate, latency, tokens and cost per task.
`;

export async function GET() {
  return new Response(CONTENTS, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
