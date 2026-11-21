export default function NotFound() {
  return (
    <div className="narrow">
      <h1>यह पेज नहीं मिला</h1>
      <p className="ghost-note">शायद पता बदल गया, या जवाब हटा दिया गया।</p>
      <div className="ask-row" style={{ justifyContent: "center" }}>
        <a className="ask-btn" style={{ display: "inline-flex", alignItems: "center" }} href="/">
          सवाल पूछें
        </a>
      </div>
    </div>
  );
}
