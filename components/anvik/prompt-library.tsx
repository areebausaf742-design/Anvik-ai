import Link from "next/link";
import { ArrowUpRight, Lightbulb, Sparkles } from "lucide-react";
import { promptLibrary } from "@/lib/prompts";

const groups = ["A little clarity", "For the work ahead", "Make & imagine", "Keep learning"];
export default function PromptLibrary() {
  return <main className="studio-page library-page"><div className="studio-eyebrow"><span className="eyebrow-light"/> ANVIK / PROMPT LIBRARY</div><h1>One good prompt<br />can <span className="gradient-text">open a door.</span></h1><p className="studio-lede">A few thoughtful starting points. Take one as-is or make it your own.</p><div className="library-grid">{promptLibrary.map((prompt, index) => <Link key={prompt} href={`/chat?prompt=${encodeURIComponent(prompt)}`} className="library-card"><span className="library-card-number">{String(index + 1).padStart(2, "0")} <Lightbulb/></span><p>{prompt}</p><span className="library-card-action">TAKE IT TO CHAT <ArrowUpRight/></span></Link>)}</div><div className="library-note"><Sparkles/> You can always change the question. The best prompt is the one that sounds like you.</div></main>;
}
