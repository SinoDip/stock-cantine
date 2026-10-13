import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stocklijst Cantine",
    short_name: "Stocklijst",
    description: "Stock, vervaldata, leveringen en bestellijst van de keuken.",
    start_url: "/",
    display: "standalone",
    background_color: "#EEF2F1",
    theme_color: "#EEF2F1",
    lang: "nl",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
