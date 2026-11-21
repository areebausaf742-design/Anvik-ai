import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { langLabel } from "@/lib/detect";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const row = store.bySlug(slug);
  if (!row) return { title: "नहीं मिला" };
  const question = store.publicWithQuestions().find((x) => x.answer.id === row.id)?.question ?? row.slug;
  /* §4.3: OG text preview, deliberately no image — a text preview forwards
     like a person sharing something useful; a branded card forwards like ads. */
  return {
    title: question,
    description: row.body.replace(/\s+/g, " ").slice(0, 160),
    openGraph: {
      title: question,
      description: row.body.replace(/\s+/g, " ").slice(0, 160),
      type: "article",
    },
    robots: row.moderationState === "flagged" ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function PublicAnswer({ params }: Params) {
  const { slug } = await params;
  const row = store.bySlug(slug);
  if (!row) notFound();
  const question = store.publicWithQuestions().find((x) => x.answer.id === row.id)?.question ?? row.slug;
  const when = new Date(row.publishedAt).toLocaleDateString("hi-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <article className="pub">
      <h1 className="q-head">{question}</h1>
      <div className="a-body">{row.body}</div>
      <p className="meta-line">
        {when} · {langLabel(row.lang)} · सार्वजनिक जवाब
      </p>
      <div className="pub-cta">
        <p>अन्विक — हिंदी में कोई भी सवाल पूछें</p>
        <a className="ask-btn" style={{ display: "inline-flex", alignItems: "center" }} href="/">
          पूछें
        </a>
      </div>
    </article>
  );
}
