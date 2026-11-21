"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** §4.4 History: device-local by default. Claiming into an account is /claim. */

type Item = { q: string; slug: string; at: number };

const MAX_ITEMS = 50;

function rel(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
}

/** Validate what came out of storage before rendering it (audit H-7). */
function parse(value: string): Item[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is Item =>
      !!item && typeof item === "object" &&
      typeof (item as Item).q === "string" &&
      typeof (item as Item).slug === "string" &&
      typeof (item as Item).at === "number",
    )
    .slice(0, MAX_ITEMS);
}

export default function History() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("anvik_h");
      if (raw) setItems(parse(raw));
    } catch {
      setItems([]);
    }
    setLoaded(true);
  }, []);

  const save = (next: Item[]) => {
    setItems(next);
    try {
      localStorage.setItem("anvik_h", JSON.stringify(next.slice(0, MAX_ITEMS)));
    } catch {
      /* nothing stored: the list simply does not persist */
    }
  };

  return (
    <main className="wide-list">
      <h1>Your history</h1>
      <p className="ghost-note">
        Every question you asked on the answer engine, newest first. This list lives on this device
        only — no account, no server copy.
      </p>

      {loaded && items.length === 0 ? (
        <p className="ghost-note" style={{ marginTop: 22 }}>
          Nothing here yet. <Link href="/chat">Ask your first question</Link> and the list builds itself.
        </p>
      ) : (
        <>
          <div style={{ marginTop: 18 }}>
            {items.map((it, i) => (
              <Link className="hist-item" key={`${it.slug}-${i}`} href={`/j/${encodeURIComponent(it.slug)}`}>
                {it.q}
                <span>{rel(it.at)}</span>
              </Link>
            ))}
          </div>
          <div className="hist-tools">
            <Link href="/claim">Save history across devices</Link>
            <button
              onClick={() => {
                if (confirm("Delete all history? This cannot be undone.")) save([]);
              }}
            >
              Delete all
            </button>
          </div>
        </>
      )}
    </main>
  );
}
