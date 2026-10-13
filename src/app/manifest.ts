import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "SINUR HRM", short_name: "SINUR", description: "Sistem informasi SDM yayasan", start_url: "/login", display: "standalone", background_color: "#f8fafc", theme_color: "#0f766e", icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
