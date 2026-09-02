import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #07111f 0%, #0f2742 60%, #155e75 100%)",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #38bdf8, #14b8a6)",
            borderRadius: 92,
            display: "flex",
            height: 440,
            padding: 18,
            width: 440,
          }}
        >
          <div
            style={{
              background: "#07111f",
              borderRadius: 74,
              display: "flex",
              height: "100%",
              overflow: "hidden",
              position: "relative",
              width: "100%",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #ffffff, #dff7ff)",
                border: "10px solid #38bdf8",
                borderRadius: 28,
                height: 222,
                left: 76,
                position: "absolute",
                top: 54,
                width: 252,
              }}
            />
            <div style={{ background: "#bfdbfe", borderRadius: 6, height: 202, left: 198, position: "absolute", top: 64, width: 8 }} />
            <div style={{ background: "#bfdbfe", borderRadius: 6, height: 8, left: 86, position: "absolute", top: 164, width: 232 }} />
            <div style={{ background: "#ffffff", borderRadius: 8, height: 10, left: 112, position: "absolute", top: 92, width: 74 }} />
            <div style={{ background: "#ffffff", borderRadius: 8, height: 10, left: 112, position: "absolute", top: 120, width: 48 }} />
            <div style={{ background: "#07111f", borderRadius: 38, height: 72, left: 56, position: "absolute", top: 290, transform: "rotate(-21deg)", width: 306 }} />
            <div style={{ background: "linear-gradient(90deg, #14b8a6, #38bdf8, #7dd3fc)", borderRadius: 26, height: 42, left: 62, position: "absolute", top: 306, transform: "rotate(-21deg)", width: 292 }} />
            <div style={{ background: "#e2e8f0", borderRadius: 18, height: 34, position: "absolute", right: 48, top: 238, transform: "rotate(-21deg)", width: 94 }} />
            <div style={{ background: "#64748b", borderRadius: 10, height: 12, position: "absolute", right: 62, top: 249, transform: "rotate(-21deg)", width: 68 }} />
            <div style={{ background: "#a3ff12", borderRadius: 999, bottom: 72, height: 42, position: "absolute", right: 64, width: 42 }} />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
