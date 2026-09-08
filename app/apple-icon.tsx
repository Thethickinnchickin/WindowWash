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
          background: "#080704",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#080704",
            border: "4px solid #D0B830",
            borderRadius: 30,
            display: "flex",
            height: 154,
            padding: 10,
            width: 154,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#080704",
              borderRadius: 20,
              color: "#D0B830",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <div style={{ fontSize: 54, fontWeight: 900, letterSpacing: 0, lineHeight: 0.9 }}>A1</div>
            <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: 0, lineHeight: 1.1, textTransform: "uppercase" }}>Parola</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
