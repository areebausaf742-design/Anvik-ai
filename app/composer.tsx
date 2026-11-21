"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Composer v3: rounded 22px panel, soft shadow, visible focus ring, Ask inside.
 * Four example chips FILL the input (owner spec) — they never submit.
 * Skeleton in one paint, streamed answer, Stop from first token, typed
 * question never lost on failure, one silent retry on a network blip.
 */

const EXAMPLES = [
  "How do I improve my credit score?",
  "My PM-KISAN instalment has not arrived — what now?",
  "A GST notice arrived. What should I do?",
  "How do I link my Aadhaar with my PAN?",
];

const CHIPS = [
  "Improve my credit score",
  "PM-KISAN instalment stuck",
  "GST notice arrived — what now?",
  "Link Aadhaar with PAN",
];

type Phase = "idle" | "thinking" | "streaming" | "done" | "error" | "stopped";

type Meta = {
  slug?: string;
  latencyMs?: number;
  costPaise?: number;
  model?: string;
  existingSlug?: string;
  langLabel?: string;
};

export default function Composer() {
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [out, setOut] = useState("");
  const [meta, setMeta] = useState<Meta>({});
  const [quota, setQuota] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [ph, setPh] = useState(0);
  const [copied, setCopied] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/quota")
      .then((r) => r.json())
      .then((j) => setQuota(j.remaining))
      .catch(() => setQuota(null));
  }, []);

  useEffect(() => {
    if (q !== "" || phase !== "idle") return;
    const t = setInterval(() => setPh((p) => (p + 1) % EXAMPLES.length), 4000);
    return () => clearInterval(t);
  }, [q, phase]);

  const grow = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 88), 8 * 27 + 16)}px`;
  }, []);

  const pushHistory = (question: string, slug: string) => {
    try {
      const raw = localStorage.getItem("anvik_h");
      const list = raw ? (JSON.parse(raw) as { q: string; slug: string; at: number }[]) : [];
      list.unshift({ q: question, slug, at: Date.now() });
      localStorage.setItem("anvik_h", JSON.stringify(list.slice(0, 50)));
    } catch {
      /* private mode: history is a nicety, never a failure */
    }
  };

  const ask = useCallback(
    async (question: string, attempt: number) => {
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setPhase("thinking");
      setOut("");
      setErr("");
      setMeta({});
      const key = crypto.randomUUID();
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question, key }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => null)) as { message?: string } | null;
          const e = new Error(j?.message ?? "Network trouble — try once more.");
          (e as Error & { handled?: boolean }).handled = !!j?.message;
          throw e;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let seen = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const ev = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (ev.t === "meta") {
              setMeta((m) => ({
                ...m,
                existingSlug: ev.existingSlug as string | undefined,
                langLabel: ev.langLabel as string,
              }));
              if (typeof ev.quotaLeft === "number") setQuota(ev.quotaLeft as number);
            } else if (ev.t === "tok") {
              seen += ev.s as string;
              setOut(seen);
              setPhase("streaming");
            } else if (ev.t === "done") {
              setMeta((m) => ({
                ...m,
                slug: ev.slug as string,
                latencyMs: ev.latencyMs as number,
                costPaise: ev.costPaise as number,
                model: ev.model as string,
              }));
              setPhase("done");
              setQ("");
              pushHistory(question, ev.slug as string);
              requestAnimationFrame(grow);
            } else if (ev.t === "stop") {
              setPhase("stopped");
            } else if (ev.t === "err") {
              const e = new Error(ev.message as string);
              (e as Error & { handled?: boolean }).handled = true;
              throw e;
            }
          }
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const handled = (e as Error & { handled?: boolean }).handled;
        if (!handled && attempt === 0) {
          await new Promise((r) => setTimeout(r, 350));
          return ask(question, 1);
        }
        setErr((e as Error).message);
        setPhase("error");
      }
    },
    [grow],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const question = q.trim();
    if (!question || phase === "thinking" || phase === "streaming") return;
    void ask(question, 0);
  };

  const stop = () => ctrlRef.current?.abort();

  const share = async () => {
    if (!meta.slug) return;
    const url = `${location.origin}/j/${meta.slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const busy = phase === "thinking" || phase === "streaming";

  return (
    <>
      <form className="composer" onSubmit={submit}>
        <label htmlFor="q" style={{ position: "absolute", left: -9999 }}>
          Your question
        </label>
        <textarea
          id="q"
          ref={areaRef}
          className="field"
          autoFocus
          value={q}
          placeholder={EXAMPLES[ph]}
          onChange={(e) => {
            setQ(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(e as unknown as React.FormEvent);
            }
          }}
        />
        <div className="composer-row">
          <span className="quota-line" aria-live="polite">
            {quota !== null ? `${quota} free question${quota === 1 ? "" : "s"} left today` : ""}
          </span>
          <button className="ask-btn" type="submit" disabled={busy}>
            Ask
          </button>
        </div>
      </form>

      <div className="chips" role="group" aria-label="Example questions — tap to fill the box">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            className="chip"
            onClick={() => {
              setQ(c);
              requestAnimationFrame(() => {
                grow();
                areaRef.current?.focus();
              });
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {phase !== "idle" && (
        <section className="answer" aria-live="polite">
          {phase === "thinking" && (
            <div className="skeleton" aria-label="Answer on its way">
              <i />
              <i />
              <i />
            </div>
          )}
          {(phase === "streaming" || phase === "done" || phase === "stopped" || (phase === "error" && out)) && (
            <p className="out">
              {out}
              {phase === "streaming" && <span className="caret" aria-hidden />}
            </p>
          )}
          <div className="answer-tools">
            {phase === "streaming" && (
              <button onClick={stop}>Stop</button>
            )}
            {phase === "done" && meta.slug && (
              <>
                <button onClick={share}>{copied ? "Copied ✓" : "Share"}</button>
                <a href={`/j/${meta.slug}`}>Public page</a>
              </>
            )}
            {(phase === "done" || phase === "stopped") && meta.latencyMs !== undefined && (
              <span>
                {meta.existingSlug ? "existing reviewed answer · " : ""}
                {meta.model} · {(meta.latencyMs / 1000).toFixed(1)}s
                {meta.costPaise !== undefined && ` · est. ₹${(meta.costPaise / 100).toFixed(2)}`}
              </span>
            )}
          </div>
          {phase === "error" && <p className="err-line">{err}</p>}
        </section>
      )}
    </>
  );
}
