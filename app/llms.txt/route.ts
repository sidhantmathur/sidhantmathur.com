export const dynamic = "force-static";

const CONTENTS = `# Sidhant Mathur

Sales operations specialist and builder. I make internal tools and revenue
systems at Nokia, and I run A Darle 20, a marketplace for tabletop game
sessions in Latin America.

## Pages

/ — Home: background, selected work, and a chat assistant that answers
questions about my work.
/projects/adarle20 — A Darle 20: a marketplace for tabletop game sessions in
Latin America.
/projects/nokia — Reporting tools at Nokia: internal tools for a global sales
organization.
/projects/dell-ml — Sales prediction at Dell: a machine learning model for
lead targeting, built as an intern.
/resume — Resume, with a plain-text version at /resume.md.
/colophon — How this site was built.
/chat — Ask a question about my work directly.
`;

export async function GET() {
  return new Response(CONTENTS, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
