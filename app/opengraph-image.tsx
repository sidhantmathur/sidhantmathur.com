import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Sidhant Mathur";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Instrument palette, matching app/globals.css: --bg #0B0A09, --text #EFEBE4,
// --text-soft #C4BCB4, --accent #E4522B. This is what renders when the link is
// pasted into Slack or LinkedIn, so it has to read as the same object as the
// site.
export default async function Image() {
  // Satori can't use CSS font stacks — without real font data the mono
  // families silently fall back to its default sans. These TTFs are the same
  // Geist Mono the site loads via next/font.
  const [geistMonoRegular, geistMonoMedium] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/GeistMono-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/GeistMono-Medium.ttf")),
  ]);

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
            marginBottom: 40,
          }}
        />
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
            marginTop: 24,
            fontFamily: "Geist Mono",
            fontSize: 32,
            lineHeight: 1.4,
            color: "#C4BCB4",
          }}
        >
          I learn what the problem needs, then I build the thing.
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
