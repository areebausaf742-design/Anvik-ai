import Link from "next/link";
import { ArrowUpRight, Lightbulb, Sparkles } from "lucide-react";
import { promptLibrary } from "@/lib/prompts";

export default function PromptLibrary() {
  return (
    <main className="studio-page library-page">
      <p className="studio-eyebrow">
        <span className="eyebrow-light" /> Prompt library
      </p>
      <h1>
        Start from a question
        <br />
        <span className="gradient-text">that already works.</span>
      </h1>
      <p className="studio-lede">
        Twenty-four prompts written for real work. Take one as-is, or open it in chat and change it
        to sound like you.
      </p>

      <div className="library-grid">
        {promptLibrary.map((prompt, index) => (
          <Link
            key={prompt}
            href={`/chat?prompt=${encodeURIComponent(prompt)}`}
            className="library-card"
          >
            <span className="library-card-number">
              {String(index + 1).padStart(2, "0")} <Lightbulb />
            </span>
            <p>{prompt}</p>
            <span className="library-card-action">
              Open in chat <ArrowUpRight />
            </span>
          </Link>
        ))}
      </div>

      <div className="library-note">
        <Sparkles /> You can always change the question. The best prompt is the one that sounds like you.
      </div>
    </main>
  );
}
