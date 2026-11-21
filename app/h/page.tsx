"use client";

import { useEffect, useState } from "react";

/** §4.4 History: device-local by default. Claiming into an account is /claim. */

type Item = { q: string; slug: string; at: number };

function rel(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export default function History() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("anvik_h");
      if (raw) setItems(JSON.parse(raw) as Item[]);
    } catch {
      /* nothing stored yet */
    }
    setLoaded(true);
  }, []);

  const save = (next: Item[]) => {
    setItems(next);
    try {
      localStorage.setItem("anvik_h", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="wide-list">
      <h1>Your history</h1>
      <p className="ghost-note">This list lives on this device only — no account, no server copy.</p>
      {loaded && items.length === 0 ? (
        <p className="ghost-note">
          Nothing here yet. <a href="/">Ask your first question</a> and the list builds itself.
        </p>
      ) : (
        <>
          {items.map((it, i) => (
            <a className="hist-item" key={`${it.slug}-${i}`} href={`/j/${it.slug}`}>
              {it.q}
              <span>{rel(it.at)}</span>
            </a>
          ))}
          <div className="hist-tools">
            <a href="/claim">Save history across devices</a>
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
    </div>
  );
}
