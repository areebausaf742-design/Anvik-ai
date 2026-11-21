import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import Navigation from "@/components/anvik/navigation";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://anvik.ai"),
  title: { default: "ANVIK AI — One Mind. Infinite Possibilities.", template: "%s — ANVIK AI" },
  description: "One curious mind for whatever comes next. Chat, create images, explore code, and follow your ideas into the ANVIK AI universe.",
  applicationName: "ANVIK AI",
  keywords: ["AI assistant", "creative AI", "AI chat", "image generation", "code assistant"],
  openGraph: { title: "ANVIK AI — One Mind. Infinite Possibilities.", description: "A small universe for big thoughts.", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07070b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body><a className="skip-link" href="#main-content">Skip to content</a><Navigation/><div id="main-content">{children}</div></body></html>;
}
