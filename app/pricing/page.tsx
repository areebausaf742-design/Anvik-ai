import PricingRows from "./rows";

export const metadata = { title: "मूल्य" };

/** §4.5: rows on paper, not a card grid (§3.6). Prices inclusive of GST. */
export default function Pricing() {
  return (
    <div className="plans">
      <div className="pub" style={{ padding: "48px 0 0" }}>
        <h1 className="q-head" style={{ fontSize: 32 }}>
          मूल्य, रुपये में
        </h1>
        <p className="ghost-note">मुफ़्त स्तर कोई परीक्षा नहीं — तीन सवाल रोज़, हमेशा। कोई कार्ड नहीं।</p>
      </div>
      <PricingRows />
    </div>
  );
}
