"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Chrome = wordmark + one link (§3.7 translation table).
 * The saffron stroke under the wordmark is home-only (§3.3 rule 1).
 */
export default function Header() {
  const pathname = usePathname();
  const home = pathname === "/";
  return (
    <header className="site-head" data-home={home ? "1" : undefined}>
      <Link className="wordmark" href="/" aria-label="anvik — होम">
        anvik
      </Link>
      <nav>
        <Link href="/h">इतिहास</Link>
      </nav>
    </header>
  );
}
