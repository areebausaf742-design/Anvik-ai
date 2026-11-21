"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="narrow">
      <h1>That did not load</h1>
      <p className="ghost-note">
        Something broke on our side, not yours. Try once more — if it keeps happening, the answer
        pages are still readable.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 22 }}>
        <button className="ask-btn" onClick={reset}>
          Try again
        </button>
        <Link className="button button-quiet" href="/chat">
          Back to chat
        </Link>
      </div>
    </main>
  );
}
