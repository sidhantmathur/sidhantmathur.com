export const dynamic = "force-static";

const CONTENTS = `# Sidhant Mathur

I'm a sales operations specialist at Nokia in Toronto, and co-founder and CTO
of A Darle 20, a marketplace for tabletop game sessions in Latin America. I'm
looking for a revenue operations (RevOps / GTM systems) or delivery operations
role at an AI-forward company.

At Nokia I built a self-serve Power App for quarterly executive reporting, used
by 80+ stakeholders across 7 regions. It replaced a manual process that took one
finance analyst's entire workday, every day of quarter-end close. Before that I
owned headcount reporting and forecasting for a 3,000–4,000-person
organization.

## Pages

/ — Home: background, selected work, and a chat assistant that answers
questions about my work.
/projects/nokia — Reporting tools at Nokia: internal tools for a global sales
organization.
/projects/adarle20 — A Darle 20: a marketplace for tabletop game sessions in
Latin America.
/projects/dell-ml — Sales prediction model at Dell: a propensity model for
cross-sell targeting, built as an intern.
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
