export default function NotFound() {
  return (
    <div className="narrow">
      <h1>This page isn&apos;t here</h1>
      <p className="ghost-note">The address changed, or the answer was taken down.</p>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
        <a className="ask-btn" style={{ display: "inline-flex", alignItems: "center" }} href="/">
          Ask a question
        </a>
      </div>
    </div>
  );
}
