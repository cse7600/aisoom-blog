import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e3a8a",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          fontFamily: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
          borderRadius: 6,
        }}
      >
        팩
      </div>
    ),
    { ...size }
  );
}
