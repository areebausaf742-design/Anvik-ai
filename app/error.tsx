"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="narrow">
      <h1>Something broke</h1>
      <p className="ghost-note">This one is on us, not on you. Try once more.</p>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
        <button className="ask-btn" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
