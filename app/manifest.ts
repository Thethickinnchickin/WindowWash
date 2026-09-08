import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "A1 Parola Window Cleaning",
    short_name: "A1 Parola",
    description: "Bay Area window cleaning with easy online booking.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf0",
    theme_color: "#080704",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
