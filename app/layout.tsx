import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/manrope";
/* Self-hosted, subsetted (§3.4): unicode-range means a Devanagari-first page
   pulls Devanagari+Latin only; the full family never ships. */
import "@fontsource/mukta/devanagari-400.css";
import "@fontsource/mukta/devanagari-600.css";
import "@fontsource/mukta/latin-400.css";
import "@fontsource/mukta/latin-600.css";
import "./globals.css";
import Header from "./header";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "anvik — हिंदी में कोई भी सवाल पूछें",
    template: "%s · anvik",
  },
  description:
    "एक खाना, एक बटन। हिंदी या हिंग्लिश में कोई भी सवाल पूछें — जवाब पूरा, क्रम से और साझा करने योग्य।",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body>
        <Header />
        <main>{children}</main>
        <footer className="site-foot">
          <span>अन्विक — हिंदी में कोई भी सवाल पूछें</span>
          <a href="/pricing">मूल्य</a>
          <a href="/about">अन्विक क्या है</a>
        </footer>
      </body>
    </html>
  );
}
