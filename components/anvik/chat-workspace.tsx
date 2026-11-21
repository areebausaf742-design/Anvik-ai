"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useChatStore, selectActiveConversation, type ChatMessage } from "@/store/use-chat-store";
import { modes, promptIdeas } from "@/lib/prompts";
import Orb from "@/components/anvik/orb";
import Markdown from "@/components/anvik/markdown";
import { readApiKey } from "@/lib/client-key";
import FeedbackBar from "@/components/anvik/feedback-bar";
import { decodeCheck } from "@/lib/checker";
import { readMemory, type Memory } from "@/lib/learning";
import {
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  Check,
  Copy,
  ImagePlus,
  Menu,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  Search,
  Sparkles,
  X,
} from "lucide-react";

type SpeechInput = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop?: () => void;
};
type SpeechInputConstructor = new () => SpeechInput;

function id() {
  return crypto.randomUUID();
}

/**
 * Two histories exist in this product by design:
 *   - conversations (this store, the chat sidebar)
 *   - public answers (anvik_h, /h, /j/[slug]) written by /api/ask
 * Chat no longer pretends to know about the second one.
 */
export default function ChatWorkspace() {
  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const mode = useChatStore((state) => state.mode);
  const temperature = useChatStore((state) => state.temperature);
  const activeChat = useChatStore(selectActiveConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const setActive = useChatStore((state) => state.setActive);
  const setMode = useChatStore((state) => state.setMode);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const setMessageMeta = useChatStore((state) => state.setMessageMeta);

  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [memory, setMemory] = useState<Memory | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechInput | null>(null);

  useEffect(() => {
    setHydrated(true);
    setMemory(readMemory());
    const prompt = new URLSearchParams(window.location.search).get("prompt");
    if (prompt) setInput(prompt.slice(0, 1600));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeChat?.messages, pending]);

  // Abort an in-flight answer when the page goes away (audit H-12).
  useEffect(() => () => abortRef.current?.abort(), []);

  async function sendMessage(value = input) {
    const content = value.trim();
    if (!content || pending) return;
    const conversationId = activeId ?? createConversation();
    const current = useChatStore.getState().conversations.find((item) => item.id === conversationId);
    const userMessage: ChatMessage = { id: id(), role: "user", content, createdAt: Date.now() };
    const assistantId = id();
    addMessage(conversationId, userMessage);
    addMessage(conversationId, { id: assistantId, role: "assistant", content: "", createdAt: Date.now() });
    setInput("");
    setPending(true);
    setError("");
    setDemoMode(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const history = [...(current?.messages ?? []), userMessage]
        .slice(-40)
        .map(({ role, content: text }) => ({ role, content: text }));
      const apiKey = readApiKey();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anvik-device": deviceId(),
          ...(apiKey ? { "x-google-generative-ai-api-key": apiKey } : {}),
        },
        body: JSON.stringify({
          messages: history,
          mode,
          temperature,
          memory: readMemory(),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const issue = (await response.json().catch(() => null)) as { error?: string; detail?: string } | null;
        throw new Error(issue?.detail ?? issue?.error ?? "ANVIK could not connect. Please try again.");
      }

      const checkHeader = response.headers.get("x-anvik-check");
      const label = response.headers.get("x-anvik-label") ?? "From Gemini";

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        answer += decoder.decode(chunk, { stream: true });
        updateMessage(conversationId, assistantId, answer);
      }
      answer += decoder.decode();

      if (!answer.trim()) {
        updateMessage(
          conversationId,
          assistantId,
          "The model returned nothing for that message. Please try again in a moment.",
        );
        setError("ANVIK didn’t receive a response from the model.");
      } else {
        // The safety verdict travels with the answer as a private trailer.
        const { text, check } = decodeCheck(answer);
        updateMessage(conversationId, assistantId, text);
        setMessageMeta(conversationId, assistantId, {
          source: "gemini",
          credit: label,
          checked: check ? check.ok || check.changed : checkHeader === "partial",
          fixed: false,
        });
      }
    } catch (cause) {
      if (controller.signal.aborted) {
        // Stopping is not an error: keep whatever streamed, explain the rest.
        updateMessage(
          conversationId,
          assistantId,
          "_(stopped — ask again to continue)_",
        );
      } else {
        const message = cause instanceof Error ? cause.message : "Something went wrong. Please try again.";
        updateMessage(conversationId, assistantId, `**I couldn’t complete that request.** ${message}`);
        setError(message);
      }
    } finally {
      abortRef.current = null;
      setPending(false);
      fieldRef.current?.focus();
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function keySubmit(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function listen() {
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechInputConstructor;
      webkitSpeechRecognition?: SpeechInputConstructor;
    };
    const Speech = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Speech) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    const recognition = new Speech();
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      const said = event.results[0][0].transcript;
      setInput((text) => `${text}${text ? " " : ""}${said}`);
    };
    recognition.onerror = () => {
      setError("Voice input didn’t start. Check microphone permissions and try again.");
      setListening(false);
    };
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
    setError("");
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Could not copy that response. Select the text instead.");
    }
  }

  if (!hydrated) {
    return (
      <div className="workspace-loading">
        <div className="loading-orb">
          <Orb size="small" />
        </div>
        <span>Opening your workspace</span>
      </div>
    );
  }

  const activeMessages = activeChat?.messages ?? [];
  const filteredChats = conversations.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="chat-layout">
      <aside className={`chat-sidebar${sidebarOpen ? " chat-sidebar-open" : ""}`}>
        <div className="chat-side-head">
          <Link className="brand" href="/">
            <span className="brand-name">anvik<span>AI</span></span>
          </Link>
          <button
            aria-label="Close sidebar"
            className="icon-button mobile-only"
            onClick={() => setSidebarOpen(false)}
          >
            <X />
          </button>
        </div>

        <button
          className="new-chat-button"
          onClick={() => {
            createConversation();
            setSidebarOpen(false);
          }}
        >
          <MessageSquarePlus /> New conversation
        </button>

        <label className="chat-search">
          <Search />
          <span className="sr-only">Search conversations</span>
          <input
            aria-label="Search conversations"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a conversation"
          />
        </label>

        <div className="history-label">
          Conversations <MoreHorizontal />
        </div>
        <div className="chat-history">
          {filteredChats.map((chat) => (
            <button
              className={`history-item${chat.id === activeId ? " history-active" : ""}`}
              key={chat.id}
              onClick={() => {
                setActive(chat.id);
                setSidebarOpen(false);
              }}
            >
              <span className="history-dot" />
              {chat.title}
            </button>
          ))}
          {filteredChats.length === 0 && <span className="history-empty">Your conversations will gather here.</span>}
        </div>

        <div className="credit-meter">
          <div className="credit-meter-head">
            <span>Engine</span>
            <b>Powered by Gemini</b>
          </div>
          <p>All answers live. Nothing is replayed from a cache or a template.</p>
          <div className="credit-bar" aria-hidden="true">
            <span />
          </div>
          <small>gemini-2.0-flash · every message is a fresh model call</small>
        </div>

        <div className="sidebar-bottom">
          <Link href="/image">
            <ImagePlus /> Create an image
          </Link>
          <Link href="/library">
            <Sparkles /> Prompt library
          </Link>
          <Link href="/settings">
            <span className="profile-orb">A</span>
            <span>
              <b>Your space</b>
              <small>Preferences &amp; API key</small>
            </span>
            <MoreHorizontal className="profile-more" />
          </Link>
        </div>
      </aside>

      {sidebarOpen && (
        <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />
      )}

      <section className="chat-main">
        <header className="chat-topbar">
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <Menu />
          </button>
          <div className="workspace-title">
            <span className="workspace-title-icon">
              <Sparkles />
            </span>
            <span>
              ANVIK <small>PERSONAL AI</small>
            </span>
          </div>
          <label className="mode-select">
            <span>Mode</span>
            <select aria-label="AI mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              {modes.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        <div className={`conversation${activeMessages.length ? " conversation-populated" : ""}`}>
          {activeMessages.length === 0 ? (
            <div className="welcome-state">
              <div className="welcome-orb">
                <Orb size="small" />
              </div>
              <div className="welcome-kicker">
                <span /> Ready when you are
              </div>
              <h1>
                What do you need
                <br />
                <span className="gradient-text">to get clear on?</span>
              </h1>
              <p>A question, a form you don&apos;t understand, a half-formed idea. Start anywhere.</p>
              <div className="prompt-grid">
                {promptIdeas.map(({ title, text }) => (
                  <button className="prompt-card" key={title} onClick={() => void sendMessage(text)}>
                    <span>
                      <b>{title}</b>
                      <small>{text}</small>
                    </span>
                    <ArrowUpRight className="prompt-arrow" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {activeMessages.map((message) => (
                <article className={`message-row message-${message.role}`} key={message.id}>
                  <div className="message-avatar" aria-hidden="true">
                    {message.role === "assistant" ? "A" : "Y"}
                  </div>
                  <div className="message-content">
                    <span className="message-byline">{message.role === "assistant" ? "ANVIK" : "YOU"}</span>
                    {message.content ? (
                      message.role === "assistant" ? (
                        <Markdown text={message.content} className="md" />
                      ) : (
                        <p>{message.content}</p>
                      )
                    ) : (
                      <p className="thinking-copy">{pending ? "ANVIK is thinking…" : ""}</p>
                    )}
                    {message.role === "assistant" && message.content && !pending && (
                      <button className="message-copy" onClick={() => void copyMessage(message)} aria-label="Copy response">
                        {copied === message.id ? <Check /> : <Copy />}
                        {copied === message.id ? "Copied" : "Copy"}
                      </button>
                    )}
                    {message.role === "assistant" && message.content && !pending && (
                      <FeedbackBar
                        question={questionFor(activeMessages, message.id)}
                        answer={message.content}
                        checked={message.checked}
                        fixed={message.fixed}
                        credit={message.credit}
                        verdict={message.verdict}
                        taught={message.taught}
                        onVerdict={(verdict) =>
                          setMessageMeta(activeChat?.id ?? "", message.id, { verdict })
                        }
                        onTaught={() => setMessageMeta(activeChat?.id ?? "", message.id, { taught: true })}
                        onError={setError}
                      />
                    )}
                  </div>
                </article>
              ))}
              {pending && (
                <div className="thinking-indicator">
                  <span className="thinking-dot" />
                  <span>ANVIK is thinking…</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {demoMode && (
          <div className="gemini-demo-card" role="status">
            <Sparkles aria-hidden="true" />
            <span>
              <b>Demo mode</b> Add a free Gemini key in Settings for live AI answers.
            </span>
            <Link href="/settings">
              Open Settings <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        )}

        <div className="composer-dock">
          <form className="chat-composer" onSubmit={submit}>
            <textarea
              ref={fieldRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={keySubmit}
              placeholder="Ask ANVIK anything…"
              aria-label="Message ANVIK"
              rows={1}
              disabled={pending}
            />
            <div className="composer-controls">
              <div className="composer-tools">
                <button
                  type="button"
                  className="composer-tool"
                  onClick={listen}
                  aria-label={listening ? "Stop voice input" : "Use voice input"}
                  aria-pressed={listening}
                >
                  <Mic />
                </button>
                {pending && (
                  <button type="button" className="composer-tool" onClick={stop} aria-label="Stop generating">
                    <AudioLines />
                  </button>
                )}
              </div>
              <div className="composer-hint">
                <span className="smart-badge smart-on" title="Every message is answered by gemini-2.0-flash.">
                  <Sparkles aria-hidden="true" />
                  Powered by Gemini
                </span>
                <span className="composer-keys">Enter to send · Shift + Enter for a new line</span>
                <button type="submit" className="send-button" aria-label="Send message" disabled={!input.trim() || pending}>
                  {pending ? <AudioLines /> : <ArrowUp />}
                </button>
              </div>
            </div>
          </form>
          {error && (
            <p className="chat-error" role="alert">
              {error}
            </p>
          )}
          <div className="composer-disclaimer">
            ANVIK can make mistakes. Check anything important against the official page.
          </div>
        </div>
      </section>
    </div>
  );
}

/** The user message that produced a given reply. */
function questionFor(messages: ChatMessage[], replyId: string): string {
  const index = messages.findIndex((message) => message.id === replyId);
  for (let i = index - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

/** Stable per-browser id for the server's rate limiter (not a fingerprint). */
export function deviceId(): string {
  try {
    const existing = localStorage.getItem("anvik-device-id");
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem("anvik-device-id", created);
    return created;
  } catch {
    return "anon";
  }
}
