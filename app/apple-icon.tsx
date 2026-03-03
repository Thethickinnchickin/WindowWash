import { ImageResponse } from "next/og";

export const runtime = "edge";

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
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(150deg, rgba(14,165,233,1) 0%, rgba(2,132,199,1) 65%, rgba(15,23,42,1) 100%)",
          color: "white",
          fontSize: 72,
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
