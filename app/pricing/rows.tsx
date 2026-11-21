"use client";

import { useState } from "react";

const NOTE = "भुगतान वीक 7 में आता है (UPI पहले)। यह डेमो है — अभी कुछ नहीं कटेगा, कुछ नहीं माँगा जाएगा।";

export default function PricingRows() {
  const [note, setNote] = useState("");
  const pick = () => setNote(NOTE);

  return (
    <>
      <div className="plan-row">
        <h2>मुफ़्त</h2>
        <span className="price">₹0</span>
        <p>3 सवाल प्रति दिन · इतिहास इसी डिवाइस पर · सार्वजनिक पेज हाँ</p>
        <button onClick={pick}>इसी से शुरू करें</button>
      </div>
      <div className="plan-row">
        <h2>रोज़</h2>
        <span className="price">₹49/माह</span>
        <p>50 सवाल प्रति दिन · इतिहास सभी डिवाइस पर · लंबे जवाब · GST इनवॉइस</p>
        <button onClick={pick}>चुनें</button>
      </div>
      <div className="plan-row">
        <h2>साल</h2>
        <span className="price">₹399/वर्ष</span>
        <p>₹33/माह के बराबर · वही सब, पूरे साल · 32% बचत</p>
        <button onClick={pick}>चुनें</button>
      </div>
      <div className="plan-row">
        <h2>पैक</h2>
        <span className="price">₹19</span>
        <p>25 सवाल एक बार, 30 दिन वैध · सदस्यता नहीं, बस जितना चाहिए</p>
        <button onClick={pick}>चुनें</button>
      </div>
      {note && <p className="err-line" style={{ marginTop: 20 }}>{note}</p>}
    </>
  );
}
