"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { ArrowUp, Eye, ImagePlus, RefreshCw, X } from "lucide-react";
import Markdown from "@/components/anvik/markdown";
import { readApiKey, readDeviceId } from "@/lib/client-key";

/** Keep the encoded payload inside the route's 4.4 MB ceiling. */
const MAX_BYTES = 3 * 1024 * 1024;

export default function VisionStudio() {
  const [image, setImage] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [fileName, setFileName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  function chooseFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_BYTES) {
      setError("Choose a JPG, PNG, WebP or GIF image under 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result).split(",")[1] ?? "");
      setMediaType(file.type);
      setFileName(file.name);
      setAnswer("");
      setError("");
    };
    reader.onerror = () => setError("That image could not be opened. Try another file.");
    reader.readAsDataURL(file);
  }

  function reset() {
    setImage("");
    setMediaType("");
    setFileName("");
    setAnswer("");
    setError("");
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!image || pending) return;
    setPending(true);
    setError("");
    setAnswer("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const apiKey = readApiKey();
      const response = await fetch("/api/vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anvik-device": readDeviceId(),
          ...(apiKey ? { "x-google-generative-ai-api-key": apiKey } : {}),
        },
        body: JSON.stringify({
          image,
          mediaType,
          prompt: prompt.trim() || "Describe this image and point out the details that matter.",
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null;
        throw new Error(result?.detail ?? result?.error ?? "The image could not be analyzed.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let seen = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        seen += decoder.decode(value, { stream: true });
        setAnswer(seen);
      }
    } catch (issue) {
      if (!controller.signal.aborted) {
        setError(issue instanceof Error ? issue.message : "Could not analyze this image.");
      }
    } finally {
      abortRef.current = null;
      setPending(false);
    }
  }

  return (
    <main className="studio-page vision-studio">
      <p className="studio-eyebrow">
        <span className="eyebrow-light" /> Vision
      </p>
      <h1>
        Ask about
        <br />
        <span className="gradient-text">what you are looking at.</span>
      </h1>
      <p className="studio-lede">
        Upload a photo, a form or a screenshot, then ask about a field, a line or a detail. ANVIK
        describes only what is visible.
      </p>

      <form className="vision-layout" onSubmit={analyze}>
        <label className={`vision-upload${image ? " vision-upload-filled" : ""}`} htmlFor="vision-file">
          {image ? (
            <>
              <Image
                src={`data:${mediaType};base64,${image}`}
                alt="Image selected for analysis"
                width={1024}
                height={768}
                unoptimized
              />
              <span className="vision-file-name">{fileName}</span>
            </>
          ) : (
            <>
              <span className="vision-upload-icon">
                <ImagePlus />
              </span>
              <b>Choose an image</b>
              <small>JPG, PNG, WebP or GIF · up to 3 MB</small>
              <span className="vision-select">Browse files</span>
            </>
          )}
          <input
            id="vision-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </label>

        <div className="vision-prompt">
          <label htmlFor="vision-question">What should ANVIK look for?</label>
          <textarea
            id="vision-question"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={1200}
            placeholder="What is this form asking for in section 3?"
          />
          <button className="button button-bright" disabled={!image || pending}>
            {pending ? (
              <>
                <span className="button-spinner" /> Looking
              </>
            ) : (
              <>
                Ask about this image <ArrowUp />
              </>
            )}
          </button>
          {image && (
            <button className="vision-remove" type="button" onClick={reset}>
              <X /> Remove image
            </button>
          )}
        </div>
      </form>

      {error && (
        <p className="studio-error" role="alert">
          {error}
        </p>
      )}

      {answer && (
        <section className="vision-answer">
          <div className="vision-answer-label">
            <span>
              <Eye /> ANVIK noticed
            </span>
            <button aria-label="Clear analysis" onClick={() => setAnswer("")}>
              <RefreshCw />
            </button>
          </div>
          <Markdown text={answer} className="md" />
        </section>
      )}

      {pending && !answer && (
        <div className="vision-wait" role="status">
          <span className="thinking-dot" /> ANVIK is looking closer…
        </div>
      )}
    </main>
  );
}
