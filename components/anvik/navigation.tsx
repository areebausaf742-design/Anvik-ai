"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, AudioLines, Code2, Eye, Image, MessageSquareText, Settings2 } from "lucide-react";

const links = [
  { href: "/chat", label: "Chat", icon: MessageSquareText },
  { href: "/image", label: "Image studio", icon: Image },
  { href: "/code", label: "Code lab", icon: Code2 },
  { href: "/voice", label: "Voice mode", icon: AudioLines },
  { href: "/vision", label: "Vision", icon: Eye },
];

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link className={`brand${compact ? " brand-compact" : ""}`} href="/" aria-label="ANVIK AI home"><span className="brand-orb"><span>A</span></span>{!compact && <span className="brand-name">ANVIK<span>AI</span></span>}</Link>;
}

export default function Navigation() {
  const pathname = usePathname();
  return <header className="top-nav"><Brand /><nav aria-label="Main navigation" className="nav-links"><Link href="/#universe">The universe</Link><Link href="/#capabilities">Capabilities</Link><Link href="/#plans">Plans</Link></nav><div className="nav-actions"><Link href="/login" className="nav-login">Sign in</Link><Link className="button button-small button-bright" href="/chat">Open ANVIK <ArrowUpRight aria-hidden="true" /></Link></div>
    {pathname !== "/" && <nav className="app-nav" aria-label="AI workspace">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "app-nav-active" : ""}><Icon aria-hidden="true" /><span>{label}</span></Link>)}<Link href="/settings" aria-current={pathname === "/settings" ? "page" : undefined}><Settings2 aria-hidden="true" /><span>Settings</span></Link></nav>}
  </header>;
}
