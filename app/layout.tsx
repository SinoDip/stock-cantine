import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Stocklijst Cantine",
  description: "Stock, vervaldata, leveringen en bestellijst van de keuken.",
  applicationName: "Stocklijst",
  appleWebApp: { capable: true, title: "Stocklijst", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEF2F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1412" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
