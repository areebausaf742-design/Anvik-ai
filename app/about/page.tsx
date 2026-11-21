export const metadata = { title: "About Anvik" };

/** §4.7: five sections, no imagery. अन्विक appears exactly once, here (§3.2). */
export default function About() {
  return (
    <div className="about">
      <h1>
        anvik <span className="deva-once">अन्विक</span>
      </h1>
      <blockquote>
        प्रदीपः सर्वविद्यानाम् उपायः सर्वकर्मणाम् ।
        <br />
        आश्रयः सर्वधर्माणां शाश्वतं अन्वीक्षिकी मता ॥
      </blockquote>
      <p>
        &ldquo;Anvikshiki is the lamp of all the sciences, the means of all actions, and the
        support of all dharma.&rdquo; — Kautilya, <em>Arthashastra</em>. The discipline of
        inquiry: examining what follows from what. The product is named for it.
      </p>

      <h2>WHAT IT DOES</h2>
      <p>
        One field. Write any question in Hindi, Hinglish or English and get a full, ordered
        answer in the language you asked in. Every answer gets its own public page you can
        forward to anyone. No account and no card to start: three questions a day, free,
        forever.
      </p>

      <h2>WHAT IT WILL NOT ANSWER</h2>
      <p>
        Some questions are not ours to answer: diagnosing illness or dosing medicine (we route
        to a doctor and to 108), predicting the outcome of a legal case, recommending a specific
        stock, fund or investment, and any path that harms someone. Where an answer is limited,
        we say where the limit is and name the official source.
      </p>

      <h2>COST, NOT HIDDEN</h2>
      <p>
        Every answer&apos;s estimated cost is written to our own ledger in rupee paise, and the
        product&apos;s limits are set by it: a global daily ceiling past which the site stops
        taking questions but keeps serving every public answer. The full arithmetic lives in
        the open in <code>docs/ANVIK-PLAN.md</code>.
      </p>

      <h2>A HUMAN, IF YOU NEED ONE</h2>
      <p>
        One address: <a href="mailto:namaste@anvik.ai">namaste@anvik.ai</a>. We read it, and we
        try to answer within two working days. No form.
      </p>
    </div>
  );
}
