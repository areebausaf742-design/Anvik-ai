import { store } from "@/lib/store";
import Composer from "./composer";

export const dynamic = "force-dynamic";

/**
 * §4.1 Ask. No headline above the field — the field is the hero and introduces
 * itself (§3.7 closing note). Proof below the fold is real corpus answers as
 * text links, never imagery (§3.6).
 */
export default function Home() {
  const recent = store.publicWithQuestions().slice(0, 3);
  return (
    <>
      <div className="ask-wrap" data-screen="home">
        <Composer />
      </div>
      <section className="corpus" aria-label="पूछे गए सवाल">
        <h2>आज पूछे गए सवाल</h2>
        <ul>
          {recent.map(({ answer, question }) => (
            <li key={answer.id}>
              <a href={`/j/${answer.slug}`}>
                {question}
                <span>{answer.body.split("\n")[0].slice(0, 96)}…</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
