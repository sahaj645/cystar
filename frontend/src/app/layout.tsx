import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Inter for UI, JetBrains Mono for crypto hashes / tokens / code,
// Instrument Serif for editorial accents in headlines.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CyStar — Cryptographic Selective Disclosure",
  description:
    "Share what matters. Prove the rest. A production verifiable credentials platform built on Ed25519 and salted Merkle trees.",
  applicationName: "CyStar",
  authors: [{ name: "Sahaj Gaur" }],
  openGraph: {
    title: "CyStar — Cryptographic Selective Disclosure",
    description:
      "Reveal only the fields you choose. A verifier cryptographically confirms authenticity without seeing the rest.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#13110d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${mono.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans">
        {children}
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            classNames: {
              toast:
                "border border-border bg-card text-card-foreground shadow-lg",
            },
          }}
        />
      </body>
    </html>
  );
}
