"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Chrome = wordmark + one link. Saffron stroke under the wordmark, home only. */
export default function Header() {
  const pathname = usePathname();
  const home = pathname === "/";
  return (
    <header className="site-head" data-home={home ? "1" : undefined}>
      <Link className="wordmark" href="/" aria-label="anvik — home">
        anvik
      </Link>
      <nav>
        <Link href="/h">History</Link>
      </nav>
    </header>
  );
}
