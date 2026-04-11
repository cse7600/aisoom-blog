import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e3a8a",
          color: "#ffffff",
          fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            lineHeight: 1,
          }}
        >
          팩
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.1em",
            opacity: 0.85,
          }}
        >
          FACTNOTE
        </div>
      </div>
    ),
    { ...size }
  );
}
