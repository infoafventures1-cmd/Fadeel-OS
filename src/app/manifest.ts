import type { MetadataRoute } from "next";
import { APP_NAME } from "@/config";

// Makes the dashboard installable: "Add to Home Screen" on iPhone (Safari), "Install app" on Android/desktop Chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Fadeel OS",
    description: "Fadeel's personal command center",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f0e8",
    theme_color: "#f3f0e8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
