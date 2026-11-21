import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Orb from "@/components/anvik/orb";
import { Brand } from "@/components/anvik/navigation";
import { CORPUS } from "@/lib/corpus";
import { slugify } from "@/lib/transliterate";

/**
 * Landing page. Proof is the corpus itself (plan §3.6): three real questions
 * with real answers and real public URLs. No invented stats, no testimonials,
 * no gradient headline, no feature-card bento, no announcement pill.
 */

const surfaces = [
  {
    href: "/chat",
    label: "Chat",
    title: "Ask anything, follow up",
    text: "A conversation that remembers what you already said — on this device only.",
  },
  {
    href: "/image",
    label: "Image",
    title: "Turn a sentence into a picture",
    text: "Describe the scene, pick a style, download the result. Free, no card.",
  },
  {
    href: "/code",
    label: "Code",
    title: "A first draft you can run",
    text: "Describe what you are building and get code plus the reasoning behind it.",
  },
  {
    href: "/voice",
    label: "Voice",
    title: "Speak instead of typing",
    text: "Dictation runs in your browser; your words become the next question.",
  },
  {
    href: "/vision",
    label: "Vision",
    title: "Ask about a photo or a form",
    text: "Upload an image and ask what a field, a line or a detail actually means.",
  },
  {
    href: "/library",
    label: "Library",
    title: "Start from a good question",
    text: "Twenty-four prompts written for real work, not for demo screenshots.",
  },
];

/** Three real answers from the corpus, in the user's own words. */
const proofIds = ["pmkisan", "gst-notice", "aadhaar-pan"];

export default function Home() {
  const proof = proofIds
    .map((id) => CORPUS.find((entry) => entry.id === id))
    .filter((entry): entry is (typeof CORPUS)[number] => Boolean(entry));

  return (
    <main className="landing-page">
      <section className="hero-section" id="universe">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-light" aria-hidden="true" />
            English · हिंदी · Hinglish
          </p>
          <h1>
            Ask in your own words.
            <br />
            <span className="gradient-text">Get a straight answer.</span>
          </h1>
          <p className="hero-description">
            ANVIK is a personal AI that answers in the language you asked in — with the steps,
            the fee, the office and the official page. No account, no card.
          </p>
          <div className="hero-buttons">
            <Link className="button button-bright" href="/chat">
              Ask your first question <ArrowUpRight aria-hidden="true" />
            </Link>
            <a className="button button-quiet" href="#answers">
              See real answers
            </a>
          </div>
          <p className="hero-meta">
            <span className="mini-presence" aria-hidden="true" />
            Three free questions a day
            <span className="meta-divider" aria-hidden="true">/</span>
            History stays on this device
          </p>
        </div>
        <div className="hero-visual">
          <Orb />
          <div className="float-note note-one">
            <span>
              <b>Hindi in, Hindi out</b>
              <small>Devanagari answered in Devanagari</small>
            </span>
          </div>
          <div className="float-note note-two">
            <span>
              <b>Official sources</b>
              <small>pmkisan.gov.in, not a blog</small>
            </span>
            <span className="note-dot" aria-hidden="true" />
          </div>
        </div>
      </section>

      <div className="capability-ribbon" aria-hidden="true">
        <span>Chat</span>
        <i />
        Image
        <i />
        Code
        <i />
        Voice
        <i />
        Vision
        <i />
        Prompt library
      </div>

      <section className="section capabilities-section" id="capabilities">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Six surfaces, one memory</p>
            <h2>
              Start with a question.
              <br />
              <span className="muted-heading">Take it wherever it goes.</span>
            </h2>
          </div>
          <p>
            Everything you make is kept on this device, so a conversation can turn into a picture,
            a draft, or a plan without starting over.
          </p>
        </div>
        <div className="feature-grid">
          {surfaces.map(({ href, label, title, text }) => (
            <Link className="feature-card" key={href} href={href}>
              <div className="feature-top">
                <span className="feature-label">{label}</span>
              </div>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section" id="answers">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Answers, not marketing</p>
            <h2>
              What people actually ask.
              <br />
              <span className="muted-heading">Here is what they get.</span>
            </h2>
          </div>
          <p>Three real answers from the launch set, each readable on its own public page.</p>
        </div>
        <div className="feature-grid">
          {proof.map((entry) => (
            <Link
              className="feature-card"
              key={entry.id}
              href={`/j/${slugify(entry.questions.en)}`}
            >
              <div className="feature-top">
                <span className="feature-label">Answered</span>
              </div>
              <div>
                <h3>{entry.questions.en}</h3>
                <p>{entry.answers.en.split("\n")[0]}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section manifesto">
        <div className="manifesto-art">
          <Brand />
        </div>
        <div className="manifesto-copy">
          <p className="eyebrow">Why it exists</p>
          <h2>
            Anvikshiki: the lamp
            <br />
            of all the sciences.
          </h2>
          <p>
            The name comes from Kautilya&apos;s <em>Arthashastra</em> — the discipline of examining what
            follows from what. That is the whole product: a plain question, an ordered answer, and
            the official page you can check it against.
          </p>
          <Link href="/about" className="text-link">
            Read the longer story <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="plans-section" id="plans">
        <div className="plans-inner">
          <p className="eyebrow">Pricing, in rupees</p>
          <h2>
            Free to start.
            <br />
            <span className="muted-heading">₹19 when you need more.</span>
          </h2>
          <p className="plans-desc">
            Three questions a day, free, forever — no card and no trial clock. A ₹19 pack adds
            25 questions for 30 days, and ₹49 a month removes the daily limit.
          </p>
          <Link href="/pricing" className="button button-bright">
            See what it costs <ArrowUpRight aria-hidden="true" />
          </Link>
          <span className="plans-footnote">
            No setup required
            <i aria-hidden="true" />
            Your history stays on this device
          </span>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-top">
          <Brand />
          <span className="footer-tagline">A plain answer, in the language you asked in.</span>
          <Link className="button button-small button-outline" href="/chat">
            Ask ANVIK <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <div className="footer-bottom">
          <span>© 2026 ANVIK</span>
          <Link href="/about">About</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/library">Prompt library</Link>
          <Link href="/settings">Privacy &amp; settings</Link>
        </div>
      </footer>
    </main>
  );
}
