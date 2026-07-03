import { ImageResponse } from "next/og";

export const alt = "Sidhant Mathur";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
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
          background: "#FAF7F1",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 64,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "#1B1916",
          }}
        >
          Sidhant Mathur
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: "monospace",
            fontSize: 28,
            color: "#1B1916",
          }}
        >
          Sidhant Mathur · Toronto, ON · Open to new roles
        </div>
      </div>
    ),
    { ...size }
  );
}
