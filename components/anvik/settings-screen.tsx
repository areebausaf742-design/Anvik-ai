"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, ExternalLink, ShieldCheck, Trash2, X } from "lucide-react";
import { modes } from "@/lib/prompts";
import { useChatStore } from "@/store/use-chat-store";
import { clearApiKey, maskKey, readApiKey, saveApiKey } from "@/lib/client-key";

export default function SettingsScreen() {
  const mode = useChatStore((state) => state.mode);
  const setMode = useChatStore((state) => state.setMode);
  const temperature = useChatStore((state) => state.temperature);
  const setTemperature = useChatStore((state) => state.setTemperature);
  const clearHistory = useChatStore((state) => state.clearHistory);
  const [cleared, setCleared] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState("");

  // Show that a key exists without ever putting it back in the input (audit H-3).
  useEffect(() => setSavedKey(readApiKey()), []);

  function saveGeminiKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = geminiKey.trim();
    if (value.length < 20) {
      setKeyError("That does not look like a Gemini key. Keys are about 39 characters and start with AIza.");
      return;
    }
    saveApiKey(value);
    setSavedKey(value);
    setGeminiKey("");
    setKeySaved(true);
    setKeyError("");
    window.setTimeout(() => setKeySaved(false), 2500);
  }

  function removeKey() {
    clearApiKey();
    setSavedKey("");
    setGeminiKey("");
    setKeyError("");
  }

  return (
    <main className="settings-page">
      <Link className="settings-back" href="/chat">
        <ArrowLeft /> Back to chat
      </Link>
      <p className="studio-eyebrow">
        <span className="eyebrow-light" /> Settings
      </p>
      <h1>
        How ANVIK
        <br />
        <span className="gradient-text">works with you.</span>
      </h1>
      <p className="studio-lede">A key, a conversation style, and a way to clear what you have kept.</p>

      <section className="settings-card">
        <div className="settings-card-title">
          <span className="settings-icon">
            <ShieldCheck />
          </span>
          <div>
            <h2>Gemini API key</h2>
            <p>Add a free Google AI Studio key to turn on live answers.</p>
          </div>
        </div>

        {savedKey ? (
          <div className="gemini-key-status">
            <Check size={15} aria-hidden="true" />
            <span>
              Key saved on this browser: <code>{maskKey(savedKey)}</code>
            </span>
            <button className="vision-remove" onClick={removeKey} type="button">
              <X /> Remove key
            </button>
          </div>
        ) : (
          <form className="gemini-key-form" onSubmit={saveGeminiKey}>
            <label className="sr-only" htmlFor="gemini-api-key">
              Gemini API key
            </label>
            <input
              id="gemini-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={geminiKey}
              onChange={(event) => setGeminiKey(event.target.value)}
              placeholder="Paste your Gemini API key"
            />
            <button type="submit" disabled={!geminiKey.trim()}>
              {keySaved ? "Saved" : "Save"}
            </button>
          </form>
        )}

        {keyError && (
          <p className="chat-error" role="alert">
            {keyError}
          </p>
        )}

        <a className="text-link" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
          Get a free key from Google AI Studio <ExternalLink />
        </a>
        <p className="privacy-detail">
          Your key is stored in this browser only and sent with your own requests. For a key shared by
          everyone, set <code>GOOGLE_GENERATIVE_AI_API_KEY</code> in the server environment instead.
        </p>
      </section>

      <section className="settings-card">
        <div className="settings-card-title">
          <span className="settings-icon">
            <ChevronDown />
          </span>
          <div>
            <h2>Default mode</h2>
            <p>The starting point for a new conversation.</p>
          </div>
        </div>
        <div className="settings-options">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? "mode-option mode-option-active" : "mode-option"}
              onClick={() => setMode(item.id)}
            >
              <span>
                <b>{item.label}</b>
                <small>{item.hint}</small>
              </span>
              {mode === item.id && <Check />}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-title">
          <span className="settings-icon">◌</span>
          <div>
            <h2>Response character</h2>
            <p>Balance precise answers against exploratory ones.</p>
          </div>
          <span className="settings-value">{temperature.toFixed(2)}</span>
        </div>
        <label className="sr-only" htmlFor="creativity">
          Response creativity
        </label>
        <input
          id="creativity"
          className="creativity-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={temperature}
          onChange={(event) => setTemperature(Number(event.target.value))}
        />
        <div className="slider-labels">
          <span>Precise</span>
          <span>Imaginative</span>
        </div>
      </section>

      <section className="settings-card privacy-card">
        <div className="settings-card-title">
          <span className="settings-icon">
            <ShieldCheck />
          </span>
          <div>
            <h2>Where your data lives</h2>
            <p>This browser. Not an account, not a server copy.</p>
          </div>
        </div>
        <p className="privacy-detail">
          Conversations and generated images are kept in this browser&apos;s storage. A saved key is sent
          only with your own requests. Clearing site data removes all of it.
        </p>
        <a className="text-link" href="https://ai.google.dev/gemini-api/docs" target="_blank" rel="noreferrer">
          Gemini API documentation <ExternalLink />
        </a>
      </section>

      <section className="settings-card danger-card">
        <div className="settings-card-title">
          <span className="settings-icon">
            <Trash2 />
          </span>
          <div>
            <h2>Clear conversation history</h2>
            <p>Remove every conversation saved in this browser.</p>
          </div>
        </div>
        <button
          className="clear-history-button"
          onClick={() => {
            if (window.confirm("Clear all ANVIK conversations saved in this browser? This cannot be undone.")) {
              clearHistory();
              setCleared(true);
            }
          }}
        >
          {cleared ? (
            <>
              <Check /> History cleared
            </>
          ) : (
            <>
              <Trash2 /> Clear all history
            </>
          )}
        </button>
      </section>

      <p className="settings-note">Preferences are saved on this device.</p>
    </main>
  );
}
