import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "Sidhant Mathur, sales operations specialist at Nokia, looking for a revenue operations or delivery operations role";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// MERGE NOTE: these three mirror exports that land in content/recruiter.ts in
// the front-door pass (HERO, ROLE_LINE.value, POSITIONING.value), word for
// word. When that merges, replace them with imports so the card reads the same
// checked strings the front door renders and can't drift from them.
const HERO = "I build and roll out the systems sales and finance teams run on.";
const ROLE_LINE = "Sales operations specialist at Nokia · Toronto, ON";
const POSITIONING =
  "Looking for a revenue operations or delivery operations role at an AI-forward company. Canadian citizen, no visa sponsorship needed.";

// The card carries the positioning's first sentence only: both role families,
// without the work-authorization line a 500px preview has no room for.
const LOOKING_FOR = POSITIONING.slice(0, POSITIONING.indexOf(". ") + 1);

// Colours match app/globals.css: --bg #0B0A09, --text #EFEBE4, --text-soft
// #C4BCB4, --line-strong #6B6259, --accent #E4522B. This is the card a link
// shows when pasted into Slack or LinkedIn, so it carries the name, role and
// headshot the way the front door does. Check changes at link-preview size,
// about 500px wide in Slack.
export default async function Image() {
  // Satori can't use CSS font stacks: without real font data the mono family
  // silently falls back to its default sans. These TTFs are the same Geist
  // Mono the site loads (app/fonts.ts).
  const [geistMonoRegular, geistMonoMedium, headshot] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/GeistMono-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/GeistMono-Medium.ttf")),
    readFile(join(process.cwd(), "public/images/headshot.jpg")),
  ]);
  const headshotSrc = `data:image/jpeg;base64,${headshot.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#0B0A09",
          padding: "64px 80px",
        }}
      >
        {/* The prompt caret's underscore, as a mark. Same accent as the
            favicon and the live caret in the chat input. */}
        <div
          style={{
            width: 72,
            height: 6,
            background: "#E4522B",
            marginBottom: 40,
          }}
        />
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* Satori has no CSS filter, so the front door's saturation step is
              approximated with opacity over the dark ground. A plain <img>:
              Satori renders it, and next/image means nothing here. */}
          <img
            src={headshotSrc}
            width={144}
            height={144}
            alt=""
            style={{ border: "2px solid #6B6259", opacity: 0.9 }}
          />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 40 }}>
            <div
              style={{
                fontFamily: "Geist Mono",
                fontSize: 60,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: "#EFEBE4",
              }}
            >
              Sidhant Mathur
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: "Geist Mono",
                fontSize: 28,
                color: "#C4BCB4",
              }}
            >
              {ROLE_LINE}
            </div>
          </div>
        </div>
        {/* The claim, then who it is for. The two role families take the
            accent: they are what a recruiter scanning a feed matches on. */}
        <div
          style={{
            marginTop: 44,
            fontFamily: "Geist Mono",
            fontSize: 36,
            fontWeight: 500,
            lineHeight: 1.3,
            color: "#EFEBE4",
          }}
        >
          {HERO}
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: "Geist Mono",
            fontSize: 30,
            lineHeight: 1.4,
            color: "#E4522B",
          }}
        >
          {LOOKING_FOR}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Geist Mono",
          data: geistMonoRegular,
          weight: 400,
          style: "normal",
        },
        {
          name: "Geist Mono",
          data: geistMonoMedium,
          weight: 500,
          style: "normal",
        },
      ],
    }
  );
}
