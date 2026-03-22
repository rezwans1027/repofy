import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Repofy — Hiring-Grade Developer Evaluations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#0A0A0B",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#22D3EE",
            letterSpacing: "-0.02em",
          }}
        >
          repofy
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#ffffff",
            marginTop: 16,
            opacity: 0.9,
          }}
        >
          Hiring-Grade Developer Evaluations
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#a1a1aa",
            marginTop: 12,
          }}
        >
          Analyze any GitHub profile. Powered by code analysis, not resumes.
        </div>
      </div>
    ),
    { ...size },
  );
}
