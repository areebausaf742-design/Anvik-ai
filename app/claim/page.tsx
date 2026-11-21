"use client";

import { useState } from "react";

/**
 * §4.4 claim state — the screen people will compare to Claude's login.
 * One centred 420px column on paper: wordmark line, one line of reason,
 * one OTP field as an ink hairline, one green commit, one "बाद में" link.
 * No social buttons, no floating card, no photograph, no serif subline.
 * Its single saffron event is the focus underline (globals.css).
 */
export default function Claim() {
  const [otp, setOtp] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="narrow" data-screen="claim">
      <h1>इतिहास, हर डिवाइस पर</h1>
      <p className="ghost-note">अपना इतिहास सभी डिवाइस पर देखने के लिए मोबाइल नंबर जोड़ें।</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNote("डेमो में OTP वीक 8 से। अभी आपका इतिहास इसी डिवाइस पर सुरक्षित है — कुछ खो नहीं रहा।");
        }}
      >
        <input
          className="field"
          style={{ textAlign: "center" }}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="मोबाइल नंबर"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 10))}
          aria-label="मोबाइल नंबर"
        />
        <div className="ask-row" style={{ justifyContent: "center" }}>
          <button className="ask-btn" type="submit" disabled={otp.length !== 10}>
            OTP भेजें
          </button>
        </div>
      </form>
      {note && <p className="err-line">{note}</p>}
      <p style={{ marginTop: 18 }}>
        <a href="/h">बाद में</a>
      </p>
    </div>
  );
}
