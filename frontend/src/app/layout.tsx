import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

// Disable static prerendering for the entire app.
// All pages either use client-side auth (localStorage) or render server-side
// per request — neither benefits from static generation.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CyStar — Selective Disclosure",
  description: "Cryptographic Verifiable Credentials with selective disclosure on Ed25519 + Merkle trees.",
  applicationName: "CyStar",
  authors: [{ name: "Sahaj Gaur" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0f1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
