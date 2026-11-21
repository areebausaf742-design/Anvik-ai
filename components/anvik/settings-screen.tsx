"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { modes } from "@/lib/prompts";
import { useChatStore } from "@/store/use-chat-store";
import { clearApiKey, maskKey, readApiKey, saveApiKey } from "@/lib/client-key";
import {
  DEFAULT_MEMORY,
  EMPTY_LEARNING,
  clearLearning,
  clearMemory,
  learningStats,
  readLearning,
  readMemory,
  writeMemory,
  type Learning,
  type Memory,
  type Style,
} from "@/lib/learning";
import { freeShare, readUsage, SOFT_DAILY_LIMIT, type Usage } from "@/lib/credit";

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

  const [memory, setMemory] = useState<Memory>(DEFAULT_MEMORY);
  const [learning, setLearning] = useState<Learning>(EMPTY_LEARNING);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [memorySaved, setMemorySaved] = useState(false);

  // Show that a key exists without ever putting it back in the input (audit H-3).
  useEffect(() => {
    setSavedKey(readApiKey());
    setMemory(readMemory());
    setLearning(readLearning());
    setUsage(readUsage());
  }, []);

  const stats = learningStats(learning);

  function remember(next: Partial<Memory>) {
    const merged = writeMemory(next);
    setMemory(merged);
    setMemorySaved(true);
    window.setTimeout(() => setMemorySaved(false), 2000);
  }

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
          <span className="settings-icon">
            <Brain />
          </span>
          <div>
            <h2>Memory</h2>
            <p>What ANVIK should remember about you in every conversation.</p>
          </div>
          {memorySaved && (
            <span className="settings-value" role="status">
              Saved
            </span>
          )}
        </div>

        <div className="memory-grid">
          <label className="memory-field">
            <span>Name</span>
            <input
              type="text"
              maxLength={40}
              value={memory.name}
              placeholder="What should ANVIK call you?"
              onChange={(event) => setMemory({ ...memory, name: event.target.value })}
              onBlur={() => remember({ name: memory.name.trim() })}
            />
          </label>

          <label className="memory-field">
            <span>Preferred language</span>
            <select
              value={memory.lang}
              onChange={(event) => remember({ lang: event.target.value as Memory["lang"] })}
            >
              <option value="en">English</option>
              <option value="hi-Latn">Hinglish</option>
              <option value="hi">हिन्दी</option>
            </select>
          </label>
        </div>

        <p className="memory-label">Preferred answer style</p>
        <div className="settings-options memory-styles">
          {(
            [
              { id: "short", label: "Short", hint: "Two or three sentences." },
              { id: "detailed", label: "Detailed", hint: "Steps and official sources." },
              { id: "coder", label: "Coder", hint: "Code first, no small talk." },
            ] as { id: Style; label: string; hint: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className={memory.style === item.id ? "mode-option mode-option-active" : "mode-option"}
              onClick={() => remember({ style: item.id })}
            >
              <span>
                <b>{item.label}</b>
                <small>{item.hint}</small>
              </span>
              {memory.style === item.id && <Check />}
            </button>
          ))}
        </div>

        <div className="memory-actions">
          <button
            className="clear-history-button"
            type="button"
            onClick={() => {
              clearMemory();
              setMemory(DEFAULT_MEMORY);
            }}
          >
            <Trash2 /> Clear memory
          </button>
          <p className="privacy-detail">
            Saved in this browser as <code>anvik-memory</code>. Never keys, passwords or phone numbers.
          </p>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-title">
          <span className="settings-icon">
            <GraduationCap />
          </span>
          <div>
            <h2>What ANVIK learned</h2>
            <p>From your likes, dislikes and corrections on this device.</p>
          </div>
          {usage && (
            <span className="settings-value">
              {freeShare(usage)}% free today
            </span>
          )}
        </div>

        <div className="learning-stats">
          <div>
            <b>{stats.corrections}</b>
            <span>corrections</span>
          </div>
          <div>
            <b>{stats.likes}</b>
            <span>likes</span>
          </div>
          <div>
            <b>{stats.dislikes}</b>
            <span>dislikes</span>
          </div>
          <div>
            <b>{stats.replays}</b>
            <span>replays at 0 credits</span>
          </div>
        </div>

        {stats.topTopics.length > 0 ? (
          <div className="learning-topics">
            <p className="memory-label">Topics you ask about</p>
            <ul>
              {stats.topTopics.map((topic) => (
                <li key={topic.topic}>
                  <span>{topic.topic}</span>
                  <small>{topic.count}</small>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="privacy-detail">
            Nothing learned yet. Like an answer, or use “Teach ANVIK” under a reply, and it appears here.
          </p>
        )}

        {stats.bestReplies.length > 0 && (
          <div className="learning-best">
            <p className="memory-label">Your three most-liked answers</p>
            {stats.bestReplies.map((item) => (
              <blockquote key={`${item.question}-${item.at}`}>
                <span>{item.question}</span>
                <p>{item.answer.length > 220 ? `${item.answer.slice(0, 220)}…` : item.answer}</p>
              </blockquote>
            ))}
          </div>
        )}

        <div className="memory-actions">
          <button
            className="clear-history-button"
            type="button"
            onClick={() => {
              if (window.confirm("Delete everything ANVIK learned on this device, including liked answers?")) {
                clearLearning();
                setLearning(EMPTY_LEARNING);
              }
            }}
          >
            <Trash2 /> Clear what ANVIK learned
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-title">
          <span className="settings-icon">
            <Sparkles />
          </span>
          <div>
            <h2>Credits and limits</h2>
            <p>How much of today&apos;s usage reached a model.</p>
          </div>
        </div>
        <div className="learning-stats">
          <div>
            <b>{usage?.chats ?? 0}</b>
            <span>live chats today</span>
          </div>
          <div>
            <b>{usage?.free ?? 0}</b>
            <span>answers at 0 credits</span>
          </div>
          <div>
            <b>{SOFT_DAILY_LIMIT}</b>
            <span>soft daily limit</span>
          </div>
        </div>
        <p className="privacy-detail">
          Greetings, repeat questions answered in the last 7 days, and answers from the reviewed set never
          count against the limit. Only <code>gemini-2.0-flash</code> is used, with 800 tokens for chat and
          1,500 for code.
        </p>
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
