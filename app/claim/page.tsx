"use client";

import { useState } from "react";

/**
 * §4.4 claim state. One centred column on paper: reason line, one OTP field,
 * one green commit, one "Later" link. No social buttons, no card, no photo.
 */
export default function Claim() {
  const [otp, setOtp] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="narrow" data-screen="claim">
      <h1>Your history, on every device</h1>
      <p className="ghost-note">Add a mobile number to see this device&apos;s history everywhere you ask.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNote("OTP arrives with the Week 8 build. Until then your history is safe on this device — nothing is lost.");
        }}
      >
        <input
          className="field"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Mobile number"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 10))}
          aria-label="Mobile number"
        />
        <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
          <button className="ask-btn" type="submit" disabled={otp.length !== 10}>
            Send OTP
          </button>
        </div>
      </form>
      {note && <p className="err-line">{note}</p>}
      <p style={{ marginTop: 18 }}>
        <a href="/h">Later</a>
      </p>
    </div>
  );
}
