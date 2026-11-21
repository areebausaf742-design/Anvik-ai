"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="narrow">
      <h1>कुछ टूट गया</h1>
      <p className="ghost-note">यह हमारी गलती है, आपकी नहीं। एक बार फिर कोशिश करें।</p>
      <div className="ask-row" style={{ justifyContent: "center" }}>
        <button className="ask-btn" onClick={reset}>
          फिर कोशिश करें
        </button>
      </div>
    </div>
  );
}
