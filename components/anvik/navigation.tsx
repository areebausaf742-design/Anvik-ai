"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines, Code2, Eye, Image as ImageIcon, MessageSquareText, Settings2 } from "lucide-react";

const links = [
  { href: "/chat", label: "Chat", icon: MessageSquareText },
  { href: "/image", label: "Image", icon: ImageIcon },
  { href: "/code", label: "Code", icon: Code2 },
  { href: "/voice", label: "Voice", icon: AudioLines },
  { href: "/vision", label: "Vision", icon: Eye },
];

/**
 * Chrome is the wordmark plus the app links (plan §3.6). No icon in the
 * wordmark, no marketing nav on product screens, no sign-in wall.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="ANVIK home">
      <span className="brand-name">
        anvik{!compact && <span>AI</span>}
      </span>
    </Link>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const onProduct = pathname !== "/" && !["/login", "/pricing", "/about"].includes(pathname);

  return (
    <header className="top-nav">
      <Brand />
      {!onProduct && (
        <nav aria-label="Main navigation" className="nav-links">
          <Link href="/chat">Chat</Link>
          <Link href="/library">Prompt library</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
        </nav>
      )}
      {!onProduct && (
        <div className="nav-actions">
          <Link href="/settings" className="nav-login">Settings</Link>
          <Link className="button button-small button-bright" href="/chat">Ask ANVIK</Link>
        </div>
      )}
      {onProduct && (
        <nav className="app-nav" aria-label="Workspace">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "app-nav-active" : ""}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
          <Link href="/settings" aria-current={pathname === "/settings" ? "page" : undefined}>
            <Settings2 aria-hidden="true" />
            <span>Settings</span>
          </Link>
        </nav>
      )}
    </header>
  );
}
