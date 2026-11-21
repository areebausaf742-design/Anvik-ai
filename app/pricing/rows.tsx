"use client";

import { useState } from "react";

const NOTE =
  "Payments arrive in Week 7 (UPI first). This is a demo — nothing will be charged and nothing will be asked for.";

export default function PricingRows() {
  const [note, setNote] = useState("");
  const pick = () => setNote(NOTE);

  return (
    <>
      <div className="plan-row">
        <h2>Free</h2>
        <span className="price">₹0</span>
        <p>3 questions a day · history on this device · public pages included</p>
        <button onClick={pick}>Start here</button>
      </div>
      <div className="plan-row">
        <h2>Daily</h2>
        <span className="price">₹49/mo</span>
        <p>50 questions a day · history on every device · longer answers · GST invoice</p>
        <button onClick={pick}>Choose</button>
      </div>
      <div className="plan-row">
        <h2>Yearly</h2>
        <span className="price">₹399/yr</span>
        <p>Works out to ₹33/mo · everything in Daily, all year · 32% cheaper</p>
        <button onClick={pick}>Choose</button>
      </div>
      <div className="plan-row">
        <h2>Pack</h2>
        <span className="price">₹19</span>
        <p>25 questions once, valid 30 days · no subscription, just what you need</p>
        <button onClick={pick}>Choose</button>
      </div>
      {note && (
        <p className="err-line" style={{ marginTop: 20 }}>
          {note}
        </p>
      )}
    </>
  );
}
