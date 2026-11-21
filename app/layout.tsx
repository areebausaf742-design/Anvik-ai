import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import Navigation from "@/components/anvik/navigation";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://anvik.ai";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "ANVIK — a straight answer, in your language", template: "%s — ANVIK" },
  description:
    "Ask a question in English, Hindi or Hinglish and get a clear, ordered answer with official sources. Free to start, no account needed.",
  applicationName: "ANVIK",
  keywords: ["Hindi AI", "Hinglish", "government schemes", "PM-KISAN", "GST notice", "Aadhaar PAN", "ANVIK"],
  openGraph: {
    title: "ANVIK — a straight answer, in your language",
    description:
      "Ask in English, Hindi or Hinglish. Get the steps, the fee, the office and the official page.",
    type: "website",
    siteName: "ANVIK",
    url: siteUrl,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "ANVIK — a straight answer, in your language",
    description: "Ask in English, Hindi or Hinglish. Get the steps, the fee, the office and the official page.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf7f2",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Navigation />
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
