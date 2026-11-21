"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Sidebar shell (owner spec, 21 Nov): wordmark, New chat, History, account
 * placeholder at the bottom. Fixed column on desktop, drawer on mobile with
 * an overlay; every control is a real focusable element ≥44px.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nav = (
    <>
      <div className="wordmark">
        <Link href="/" aria-label="Anvik home">
          anvik
        </Link>
      </div>
      <nav aria-label="Main">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          <span className="dot" aria-hidden />
          New chat
        </Link>
        <Link href="/h" aria-current={pathname === "/h" ? "page" : undefined}>
          <span className="dot" aria-hidden />
          History
        </Link>
      </nav>
      <div className="spacer" />
      <Link className="acct" href="/claim">
        <span className="avatar" aria-hidden>
          A
        </span>
        <span>
          <b>Sign in</b>
          <i>Free plan · 3 a day</i>
        </span>
      </Link>
    </>
  );

  return (
    <>
      <div className="topbar">
        <span className="wordmark">anvik</span>
        <button
          className="menu-btn"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="sidebar"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && <div className="overlay" onClick={() => setOpen(false)} aria-hidden />}
      <aside className="side" id="sidebar" data-open={open ? "1" : undefined}>
        {nav}
      </aside>
    </>
  );
}
