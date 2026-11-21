"use client";

import { useEffect, useState } from "react";

/** §4.4 History: device-local by default. Claiming into an account is §/claim. */

type Item = { q: string; slug: string; at: number };

function rel(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return "अभी";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} मिनट पहले`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} घंटे पहले`;
  return `${Math.floor(h / 24)} दिन पहले`;
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
      <h1>आपका इतिहास</h1>
      <p className="ghost-note">यह सूची इसी डिवाइस पर रहती है — कोई खाता नहीं, कोई सर्वर नहीं।</p>
      {loaded && items.length === 0 ? (
        <p className="ghost-note">
          अभी कुछ नहीं। <a href="/">पहला सवाल पूछें</a> — सूची यहाँ बनती जाएगी।
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
            <a href="/claim">अपना इतिहास सभी डिवाइस पर सेव करें</a>
            <button
              onClick={() => {
                if (confirm("पूरा इतिहास हटाएं? यह वापस नहीं आएगा।")) save([]);
              }}
            >
              सब हटाएं
            </button>
          </div>
        </>
      )}
    </div>
  );
}
