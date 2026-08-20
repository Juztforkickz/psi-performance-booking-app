import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PSI Performance Booking",
    short_name: "PSI Booking",
    description: "Request a vehicle service or dyno tune with PSI Performance Garage.",
    start_url: "/",
    display: "standalone",
    background_color: "#080808",
    theme_color: "#080808",
    orientation: "portrait-primary",
    categories: ["automotive", "business"],
    icons: [
      {
        src: "/psi-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/psi-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/psi-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/psi-favicon.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  };
}
