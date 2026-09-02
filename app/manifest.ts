import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "a1parola",
    short_name: "a1parola",
    description: "Field worker and admin operations for window washing teams",
    start_url: "/",
    display: "standalone",
    background_color: "#f5fbff",
    theme_color: "#00d5ff",
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
