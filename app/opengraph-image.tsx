import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { ROLE_LINE } from "@/content/recruiter";

export const alt = "Sidhant Mathur — revenue and sales operations";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// The role line splits at its colon: the role on one line, the sentence that
// says what that means under it. It is the same checked string the front door
// renders (content/recruiter.ts), so the card can't drift from it.
const [ROLE, ROLE_DETAIL] = ROLE_LINE.value.split(": ");

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
          padding: "80px",
        }}
      >
        {/* The prompt caret's underscore, as a mark. Same accent as the
            favicon and the live caret in the chat input. */}
        <div
          style={{
            width: 72,
            height: 6,
            background: "#E4522B",
            marginBottom: 48,
          }}
        />
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* Satori has no CSS filter, so the front door's saturation step is
              approximated with opacity over the dark ground. A plain <img>:
              Satori renders it, and next/image means nothing here. */}
          <img
            src={headshotSrc}
            width={176}
            height={176}
            alt=""
            style={{ border: "2px solid #6B6259", opacity: 0.9 }}
          />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 48 }}>
            <div
              style={{
                fontFamily: "Geist Mono",
                fontSize: 64,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: "#EFEBE4",
              }}
            >
              Sidhant Mathur
            </div>
            <div
              style={{
                marginTop: 16,
                fontFamily: "Geist Mono",
                fontSize: 36,
                fontWeight: 500,
                color: "#E4522B",
              }}
            >
              {ROLE}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 48,
            fontFamily: "Geist Mono",
            fontSize: 32,
            lineHeight: 1.4,
            color: "#C4BCB4",
          }}
        >
          {ROLE_DETAIL}
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
