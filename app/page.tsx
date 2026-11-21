import { store } from "@/lib/store";
import Composer from "./composer";

export const dynamic = "force-dynamic";

/**
 * §4.1 v2 (owner amendment, 21 Nov): AI-Studio-class composition in Anvik's
 * skin — statement headline, elevated composer, text-only chips, content
 * gallery below the fold. Chrome is full English by owner decision; answer
 * language still follows the asker (§6.1).
 */
export default function Home() {
  const recent = store.publicWithQuestions().slice(0, 3);
  return (
    <>
      <section className="hero" data-screen="home">
        <p className="status-line">DEMO ENGINE · LIVE MODEL AFTER THE MEASUREMENT WEEK</p>
        <h1>Every question deserves a straight answer.</h1>
        <p className="sub">
          One field. No account, no cards, no clutter. Ask in plain words — get an
          answer worth forwarding.
        </p>
        <Composer />
      </section>

      <section className="gallery" aria-label="Recently answered">
        <div className="gallery-head">
          <h2>RECENTLY ANSWERED</h2>
          <a href="/about">how anvik works</a>
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
