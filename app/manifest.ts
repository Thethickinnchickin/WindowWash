import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "A1 Parola Windows, Gutters & Solar Cleaning",
    short_name: "A1 Parola",
    description: "Bay Area window, gutter, and solar panel cleaning with easy online booking.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf0",
    theme_color: "#080704",
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
