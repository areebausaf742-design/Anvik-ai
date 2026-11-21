import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
/* Chrome is Manrope-only and English-only (owner spec, 21 Nov). The Mukta
   Devanagari face is declared but never referenced by chrome: it downloads
   only if an answer actually contains Devanagari glyphs (.out / .a-body fall
   back to it per-glyph). An English page ships zero Devanagari bytes. */
import "@fontsource/mukta/devanagari-400.css";
import "./globals.css";
import Sidebar from "./sidebar";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Anvik — ask anything",
    template: "%s · Anvik",
  },
  description:
    "One field, no account. Ask anything in plain words and get a clear answer in the language you wrote. Free to start, every reviewed answer shareable.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Sidebar />
        <div className="shell">
          <main id="main">{children}</main>
          <footer className="site-foot">
            <span>Anvik — ask anything</span>
            <a href="/pricing">Pricing</a>
            <a href="/about">About</a>
          </footer>
        </div>
      </body>
    </html>
  );
}
