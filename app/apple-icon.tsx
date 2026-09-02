import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
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
            borderRadius: 34,
            display: "flex",
            height: 154,
            padding: 6,
            width: 154,
          }}
        >
          <div
            style={{
              background: "#07111f",
              borderRadius: 27,
              display: "flex",
              height: "100%",
              overflow: "hidden",
              position: "relative",
              width: "100%",
            }}
          >
            <div style={{ background: "linear-gradient(135deg, #ffffff, #dff7ff)", border: "4px solid #38bdf8", borderRadius: 10, height: 78, left: 27, position: "absolute", top: 19, width: 89 }} />
            <div style={{ background: "#bfdbfe", borderRadius: 3, height: 71, left: 70, position: "absolute", top: 23, width: 3 }} />
            <div style={{ background: "#bfdbfe", borderRadius: 3, height: 3, left: 31, position: "absolute", top: 58, width: 82 }} />
            <div style={{ background: "#ffffff", borderRadius: 3, height: 4, left: 40, position: "absolute", top: 33, width: 26 }} />
            <div style={{ background: "#ffffff", borderRadius: 3, height: 4, left: 40, position: "absolute", top: 43, width: 17 }} />
            <div style={{ background: "#07111f", borderRadius: 14, height: 25, left: 20, position: "absolute", top: 102, transform: "rotate(-21deg)", width: 108 }} />
            <div style={{ background: "linear-gradient(90deg, #14b8a6, #38bdf8, #7dd3fc)", borderRadius: 9, height: 15, left: 22, position: "absolute", top: 108, transform: "rotate(-21deg)", width: 103 }} />
            <div style={{ background: "#e2e8f0", borderRadius: 7, height: 12, position: "absolute", right: 17, top: 84, transform: "rotate(-21deg)", width: 33 }} />
            <div style={{ background: "#64748b", borderRadius: 4, height: 4, position: "absolute", right: 22, top: 88, transform: "rotate(-21deg)", width: 24 }} />
            <div style={{ background: "#a3ff12", borderRadius: 999, bottom: 25, height: 15, position: "absolute", right: 23, width: 15 }} />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
