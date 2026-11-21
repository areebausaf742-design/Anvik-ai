import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/manrope";
/* Self-hosted, subsetted (§3.4): unicode-range ships only the subsets a page
   actually renders. Chrome is English by owner decision (21 Nov); Devanagari
   subsets still load whenever an answer or question is in Hindi. */
import "@fontsource/mukta/devanagari-400.css";
import "@fontsource/mukta/devanagari-600.css";
import "@fontsource/mukta/latin-400.css";
import "@fontsource/mukta/latin-600.css";
import "./globals.css";
import Header from "./header";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "anvik — ask anything, plainly",
    template: "%s · anvik",
  },
  description:
    "One field, one button. Ask anything in plain words — Hindi, Hinglish or English — and get an answer worth forwarding. Free to start, every answer shareable.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <footer className="site-foot">
          <span>Anvik — ask anything, plainly</span>
          <a href="/pricing">Pricing</a>
          <a href="/about">About</a>
        </footer>
      </body>
    </html>
  );
}
