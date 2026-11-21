import PricingRows from "./rows";

export const metadata = { title: "Pricing" };

/** §4.5: rows on paper, not a card grid. Prices inclusive of GST. */
export default function Pricing() {
  return (
    <div className="plans">
      <div className="pub" style={{ padding: "48px 0 0" }}>
        <h1 className="q-head" style={{ fontSize: 32 }}>
          Prices, in rupees
        </h1>
        <p className="ghost-note">
          The free tier is not a trial — three questions a day, forever. No card, ever.
        </p>
      </div>
      <PricingRows />
    </div>
  );
}
