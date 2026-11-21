"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Orb from "@/components/anvik/orb";
import Markdown from "@/components/anvik/markdown";
import { readApiKey, readDeviceId } from "@/lib/client-key";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  Download,
  Mic,
  Pause,
  RefreshCw,
  Sparkles,
} from "lucide-react";

const styles = ["Cinematic", "Anime", "3D Render", "Cyberpunk", "Realistic"];
const imageIdeas = [
  "An iridescent jellyfish drifting through a deep-ocean city, cinematic lighting",
  "A quiet greenhouse on Mars, dawn light through glass, editorial photography",
  "A tiny paper boat sailing through a galaxy of ink, dreamlike illustration",
];

/**
 * Gallery keeps *URLs*, never base64 blobs. Twelve data-URLs overflowed the
 * 5 MB localStorage quota (audit C-9); six URLs are a few hundred bytes, and
 * the cap keeps the oldest creations from being dropped silently.
 */
const galleryStorageKey = "anvik-image-gallery";
const MAX_GALLERY = 6;

type GeneratedImage = { image: string; prompt: string; style: string; provider?: string };

function promptWithStyle(value: string, selectedStyle: string) {
  // `.replace(/[.,\s]+$/, "")` matters: without it a half-stripped suffix left
  // a trailing comma, and repeating the click grew the prompt anyway (audit C-7).
  const basePrompt = value
    .replace(/,?\s*in (cinematic|anime|3d render|cyberpunk|realistic) style,?\s*ultra detailed\.?$/i, "")
    .replace(/,?\s*in (cinematic|anime|3d render|cyberpunk|realistic) style\.?$/i, "")
    .replace(/[.,\s]+$/, "")
    .trim();
  return basePrompt ? `${basePrompt}, in ${selectedStyle.toLowerCase()} style` : "";
}

function isGeneratedImage(value: unknown): value is GeneratedImage {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GeneratedImage>;
  return typeof item.image === "string" && typeof item.prompt === "string" && typeof item.style === "string";
}

function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(styles[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [copiedPrompt, setCopiedPrompt] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(galleryStorageKey);
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) throw new Error("bad shape");
      const keep = parsed
        .filter(isGeneratedImage)
        // Drop legacy entries that stored megabytes of base64 (audit C-9).
        .filter((item) => !item.image.startsWith("data:"))
        .slice(0, MAX_GALLERY);
      if (keep.length !== parsed.length) localStorage.setItem(galleryStorageKey, JSON.stringify(keep));
      setGallery(keep);
    } catch {
      try {
        localStorage.removeItem(galleryStorageKey);
      } catch {
        /* nothing more we can do */
      }
      setGallery([]);
    }
  }, []);

  function saveGallery(nextGallery: GeneratedImage[]) {
    const limited = nextGallery.slice(0, MAX_GALLERY);
    setGallery(limited);
    try {
      localStorage.setItem(galleryStorageKey, JSON.stringify(limited));
      setNotice("");
    } catch {
      // Storage is full: keep the session usable and say what happened.
      setGallery(limited.slice(0, 2));
      setNotice("Your browser storage is full. Download an image, then remove it to keep creating.");
      try {
        localStorage.setItem(galleryStorageKey, JSON.stringify(limited.slice(0, 2)));
      } catch {
        /* give up quietly; the session still shows the newest images */
      }
    }
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const apiKey = readApiKey();
      const response = await fetch("/api/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anvik-device": readDeviceId(),
          ...(apiKey ? { "x-google-generative-ai-api-key": apiKey } : {}),
        },
        body: JSON.stringify({ prompt: prompt.trim(), style }),
      });
      const result = (await response.json().catch(() => null)) as
        | { image?: string; prompt?: string; style?: string; provider?: string; error?: string; detail?: string }
        | null;
      if (!response.ok || typeof result?.image !== "string") {
        throw new Error(result?.detail ?? result?.error ?? "Image generation could not complete.");
      }
      saveGallery([
        {
          image: result.image,
          prompt: result.prompt ?? prompt.trim(),
          style: result.style ?? style,
          provider: result.provider,
        },
        ...gallery,
      ]);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Image generation could not complete. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPrompt(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPrompt(value);
      window.setTimeout(() => setCopiedPrompt(""), 1600);
    } catch {
      setError("Could not copy the prompt. Please try again.");
    }
  }

  function remove(index: number) {
    saveGallery(gallery.filter((_, i) => i !== index));
  }

  return (
    <div className="studio-page image-studio">
      <p className="studio-eyebrow">
        <span className="eyebrow-light" /> Image studio
      </p>
      <h1>
        Describe the scene.
        <br />
        <span className="gradient-text">See it rendered.</span>
      </h1>
      <p className="studio-lede">
        Write what you want to see, pick a style, and generate. Gemini draws it when you have added
        a key; otherwise the free Flux endpoint does. Both are free to try.
      </p>

      <form className="image-prompt-panel" onSubmit={generate}>
        <label htmlFor="image-prompt">Your prompt</label>
        <textarea
          id="image-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          maxLength={1600}
          placeholder="A glass observatory floating above an ocean of clouds, warm evening light"
        />
        <div className="style-choices" role="group" aria-label="Choose an image style">
          {styles.map((item) => (
            <button
              type="button"
              aria-pressed={style === item}
              className={style === item ? "style-choice style-choice-active" : "style-choice"}
              onClick={() => {
                setStyle(item);
                setPrompt((current) => promptWithStyle(current, item));
              }}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="image-prompt-footer">
          <span>{prompt.length}/1600</span>
          <button className="button button-bright" disabled={!prompt.trim() || loading}>
            {loading ? (
              <>
                <span className="button-spinner" /> Rendering
              </>
            ) : (
              <>
                Generate image <Sparkles />
              </>
            )}
          </button>
        </div>
      </form>

      {loading && (
        <div className="image-loading" role="status" aria-live="polite">
          <div className="image-loading-orb">
            <Orb active size="large" />
          </div>
          <div className="image-loading-shimmer" />
          <p>Rendering your prompt. This can take up to a minute.</p>
        </div>
      )}

      {error && (
        <p className="studio-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="studio-error" role="status">
          {notice}
        </p>
      )}

      <div className="image-gallery-head">
        <div>
          <p className="eyebrow">Your canvas</p>
          <h2>{gallery.length ? "Your latest creations" : "A few starting points"}</h2>
        </div>
        <span>
          {gallery.length ? `${gallery.length} of ${MAX_GALLERY} saved` : "Nothing here yet"}
        </span>
      </div>

      {gallery.length ? (
        <div className="image-gallery">
          {gallery.map((item, index) => (
            <article className="generated-image" key={`${item.prompt}-${index}-${item.image.slice(-24)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Image
                src={item.image}
                alt={item.prompt}
                width={1024}
                height={1024}
                unoptimized={!item.image.startsWith("https://image.pollinations.ai")}
                sizes="(max-width: 720px) 100vw, 460px"
              />
              <div className="generated-image-meta">
                <span>
                  {item.style.toUpperCase()}
                  {item.provider === "pollinations" ? " · FLUX" : item.provider === "gemini" ? " · GEMINI" : ""}
                </span>
                <p>{item.prompt}</p>
                <div className="generated-image-actions">
                  <a href={item.image} download={`anvik-${index + 1}.png`} aria-label="Download generated image">
                    <Download /> Download
                  </a>
                  <button type="button" onClick={() => void copyPrompt(item.prompt)}>
                    <Copy /> {copiedPrompt === item.prompt ? "Copied" : "Copy prompt"}
                  </button>
                  <button type="button" onClick={() => remove(index)} aria-label="Remove from gallery">
                    <RefreshCw /> Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="image-ideas">
          {imageIdeas.map((idea, index) => (
            <button key={idea} className="image-idea" onClick={() => setPrompt(idea)}>
              <span>0{index + 1} / Try this</span>
              <p>{idea}</p>
              <ArrowRight />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CodeLab() {
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("TypeScript");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setCode("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const apiKey = readApiKey();
      const response = await fetch("/api/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anvik-device": readDeviceId(),
          ...(apiKey ? { "x-google-generative-ai-api-key": apiKey } : {}),
        },
        body: JSON.stringify({ prompt: prompt.trim(), language }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null;
        throw new Error(result?.detail ?? result?.error ?? "The code request failed.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let generated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        generated += decoder.decode(value, { stream: true });
        setCode(generated);
      }
      if (!generated.trim()) throw new Error("ANVIK didn’t receive a code response. Please try again.");
    } catch (issue) {
      if (!controller.signal.aborted) {
        setError(issue instanceof Error ? issue.message : "Could not complete that request.");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  const extension = language === "Python" ? "py" : language === "CSS" ? "css" : language === "SQL" ? "sql" : language === "JavaScript" ? "js" : "tsx";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Could not copy the code. Select it instead.");
    }
  }

  return (
    <div className="studio-page code-studio">
      <p className="studio-eyebrow">
        <span className="eyebrow-light" /> Code lab
      </p>
      <h1>
        Describe it.
        <br />
        <span className="gradient-text">Get a first draft.</span>
      </h1>
      <p className="studio-lede">
        Say what you are building and which language you want. You get code plus the reasoning —
        a starting point, not a substitute for review.
      </p>

      <div className="code-layout">
        <form className="code-brief" onSubmit={create}>
          <label htmlFor="code-prompt">What are we building?</label>
          <textarea
            id="code-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={6000}
            placeholder="A responsive pricing card with a monthly / yearly toggle"
          />
          <label htmlFor="code-language">Language</label>
          <select id="code-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option>TypeScript</option>
            <option>JavaScript</option>
            <option>Python</option>
            <option>CSS</option>
            <option>SQL</option>
          </select>
          <button className="button button-bright" disabled={!prompt.trim() || loading}>
            {loading ? (
              <>
                <span className="button-spinner" /> Writing
              </>
            ) : (
              <>
                Create a draft <ArrowUp />
              </>
            )}
          </button>
          <span className="brief-note">{prompt.length}/6000 characters</span>
        </form>

        <section className="code-output" aria-label="Generated code">
          <header>
            <div className="editor-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span>draft.{extension}</span>
            {code && (
              <button type="button" onClick={() => void copyCode()} aria-label="Copy code">
                <Copy />
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </header>
          {code ? (
            <Markdown text={code} className="md code-md" />
          ) : (
            <div className="editor-empty">
              <span className="editor-empty-icon">
                <Sparkles />
              </span>
              <b>{loading ? "Writing your draft…" : "Your draft will appear here"}</b>
              <span>
                {loading
                  ? "Thinking through the structure first."
                  : "Describe the problem on the left and the code arrives with an explanation."}
              </span>
              {loading && <div className="thinking-line" />}
            </div>
          )}
        </section>
      </div>

      {error && (
        <p className="studio-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => Recognition;

function VoiceStudio() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Speech = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Speech) {
      setError("Voice input is not available in this browser. Try Chrome or Edge.");
      return;
    }
    const recognition = new Speech();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) =>
      setTranscript(Array.from(event.results).map((result) => result[0].transcript).join(""));
    recognition.onerror = () => {
      setError("Allow microphone access to use voice mode.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setError("");
    setTranscript("");
    setAnswer("");
    setListening(true);
  }

  /** Transcribed words now have somewhere to go: /api/voice (was dead, audit H-10). */
  async function ask() {
    const text = transcript.trim();
    if (!text || pending) return;
    setPending(true);
    setError("");
    setAnswer("");
    try {
      const apiKey = readApiKey();
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anvik-device": readDeviceId(),
          ...(apiKey ? { "x-google-generative-ai-api-key": apiKey } : {}),
        },
        body: JSON.stringify({ transcript: text }),
      });
      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null;
        throw new Error(result?.detail ?? result?.error ?? "Voice assistance is unavailable right now.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let spoken = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        spoken += decoder.decode(value, { stream: true });
        setAnswer(spoken);
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not complete that request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="voice-studio">
      <Link className="voice-back" href="/chat">
        <ArrowLeft /> Back to chat
      </Link>
      <div className="voice-orb-stage">
        <div className={`voice-ripple${listening ? " ripple-live" : ""}`} />
        <div className={`voice-ripple ripple-two${listening ? " ripple-live" : ""}`} />
        <Orb active={listening} size="large" />
      </div>
      <p className="studio-eyebrow">
        <span className="eyebrow-light" /> Voice mode
      </p>
      <h1>{listening ? "I’m listening." : "Speak instead of typing."}</h1>
      <p>
        {listening
          ? "Take your time. Your words appear below as you speak."
          : "Dictation runs in your browser. Your words become the next question."}
      </p>
      <button
        className={`voice-action${listening ? " voice-action-live" : ""}`}
        onClick={toggleListening}
        aria-label={listening ? "Stop listening" : "Start speaking"}
      >
        {listening ? <Pause /> : <Mic />}
        <span>{listening ? "Stop listening" : "Start speaking"}</span>
      </button>

      {error && (
        <p className="studio-error" role="alert">
          {error}
        </p>
      )}

      <div className="voice-transcript" aria-live="polite">
        {transcript}
      </div>

      {transcript.trim() && (
        <button className="button button-bright" onClick={() => void ask()} disabled={pending}>
          {pending ? (
            <>
              <span className="button-spinner" /> Thinking
            </>
          ) : (
            <>
              Ask ANVIK <ArrowUp />
            </>
          )}
        </button>
      )}

      {answer && (
        <section className="vision-answer" aria-live="polite">
          <div className="vision-answer-label">
            <span>
              <Mic /> ANVIK said
            </span>
            <button aria-label="Clear answer" onClick={() => setAnswer("")}>
              <RefreshCw />
            </button>
          </div>
          <Markdown text={answer} className="md" />
        </section>
      )}

      <div className="voice-bottom">
        Private by design <span /> Speech recognition runs in your browser
      </div>
    </div>
  );
}

export default function CreativeStudio({ kind }: { kind: "image" | "code" | "voice" }) {
  return kind === "image" ? <ImageStudio /> : kind === "code" ? <CodeLab /> : <VoiceStudio />;
}
