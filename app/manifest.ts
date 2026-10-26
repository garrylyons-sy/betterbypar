import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Better By Par",
    short_name: "Better By Par",
    description: "Your club, lessons and player community, all together.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#061f3e",
    categories: ["sports", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png?v=bbp-blue-1",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png?v=bbp-blue-1",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-maskable-512.png?v=bbp-blue-1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
