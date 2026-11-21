import { store } from "@/lib/store";
import Composer from "./composer";

export const dynamic = "force-dynamic";

/**
 * Ask screen v3 (owner spec, 21 Nov): centred headline + one supporting line,
 * large rounded composer with the Ask button inside, four chips that FILL the
 * input, reviewed public answers below the fold. English-only chrome.
 */
export default function Home() {
  const recent = store.reviewedWithQuestions().slice(0, 3);
  return (
    <>
      <section className="hero">
        <h1>What can I help you with?</h1>
        <p className="sub">One field, no account. The answer comes back in whatever language you write.</p>
        <Composer />
      </section>

      <section className="gallery" aria-label="Reviewed public answers">
        <div className="gallery-head">
          <h2>REVIEWED PUBLIC ANSWERS</h2>
          <a href="/about">how Anvik works</a>
        </div>
        <div className="cards">
          {recent.map(({ answer, question }) => (
            <a className="card" key={answer.id} href={`/j/${answer.slug}`}>
              <h3>{question}</h3>
              <p>{answer.body.split("\n")[0].slice(0, 110)}…</p>
              <span>PUBLIC ANSWER</span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
