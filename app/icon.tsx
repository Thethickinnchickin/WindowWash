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
            border: "10px solid #D0B830",
            borderRadius: 84,
            display: "flex",
            height: 440,
            padding: 28,
            width: 440,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#080704",
              borderRadius: 58,
              color: "#D0B830",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <div style={{ fontSize: 164, fontWeight: 900, letterSpacing: 0, lineHeight: 0.9 }}>A1</div>
            <div style={{ fontSize: 50, fontWeight: 900, letterSpacing: 0, lineHeight: 1.1, textTransform: "uppercase" }}>Parola</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
