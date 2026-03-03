import { ImageResponse } from "next/og";

export const runtime = "edge";

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
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, rgba(14,165,233,1) 0%, rgba(6,182,212,1) 60%, rgba(15,23,42,1) 100%)",
          color: "white",
          fontSize: 132,
          fontWeight: 700,
        }}
      >
        WW
      </div>
    ),
    {
      ...size,
    },
  );
}
