"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useChatStore, selectActiveConversation, type ChatMessage } from "@/store/use-chat-store";
import { modes, promptIdeas } from "@/lib/prompts";
import Orb from "@/components/anvik/orb";
import { ArrowUp, ArrowUpRight, AudioLines, Check, Copy, ImagePlus, Menu, MessageSquarePlus, Mic, MoreHorizontal, Paperclip, Search, Sparkles, X } from "lucide-react";

type SpeechInput = { lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; start: () => void };
type SpeechInputConstructor = new () => SpeechInput;

function id() { return crypto.randomUUID(); }

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
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setHydrated(true); const prompt = new URLSearchParams(window.location.search).get("prompt"); if (prompt) setInput(prompt.slice(0, 1600)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [activeChat?.messages, pending]);

  async function sendMessage(value = input) {
    const content = value.trim();
    if (!content || pending) return;
    const conversationId = activeId ?? createConversation();
    const current = useChatStore.getState().conversations.find((item) => item.id === conversationId);
    const userMessage: ChatMessage = { id: id(), role: "user", content: files.length ? `${content}\n\nAttached files: ${files.join(", ")}` : content, createdAt: Date.now() };
    const assistantId = id();
    addMessage(conversationId, userMessage);
    addMessage(conversationId, { id: assistantId, role: "assistant", content: "", createdAt: Date.now() });
    setInput(""); setFiles([]); setPending(true); setError("");
    try {
      const history = [...(current?.messages ?? []), userMessage].slice(-40).map(({ role, content: text }) => ({ role, content: text }));
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, mode, temperature }) });
      if (!response.ok || !response.body) {
        const issue = await response.json().catch(() => null);
        throw new Error(issue?.error || "ANVIK could not connect. Please try again.");
      }
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
        const notice = "The AI model didn’t return a reply. Please try again in a moment; model access may be temporarily unavailable.";
        updateMessage(conversationId, assistantId, notice);
        setError("ANVIK didn’t receive a response from the model.");
      } else updateMessage(conversationId, assistantId, answer);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Something went wrong. Please try again.";
      updateMessage(conversationId, assistantId, `I couldn't complete that request. ${message}`);
      setError(message);
    } finally { setPending(false); fieldRef.current?.focus(); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void sendMessage(); }
  function keySubmit(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void sendMessage(); } }
  function listen() {
    const speechWindow = window as Window & { SpeechRecognition?: SpeechInputConstructor; webkitSpeechRecognition?: SpeechInputConstructor };
    const Speech = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Speech) { setError("Voice input is not supported in this browser. Try a recent version of Chrome or Edge."); return; }
    const recognition = new Speech(); recognition.lang = "en-US"; recognition.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => setInput((text) => `${text}${text ? " " : ""}${event.results[0][0].transcript}`); recognition.onerror = () => setError("Voice input didn’t start. Check microphone permissions and try again."); recognition.start();
  }

  if (!hydrated) return <div className="workspace-loading"><div className="loading-orb"><Orb size="small" /></div><span>OPENING YOUR UNIVERSE</span></div>;
  const activeMessages = activeChat?.messages ?? [];
  const filteredChats = conversations.filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()));

  return <div className="chat-layout">
    <aside className={`chat-sidebar${sidebarOpen ? " chat-sidebar-open" : ""}`}><div className="chat-side-head"><Link className="brand" href="/"><span className="brand-orb"><span>A</span></span><span className="brand-name">ANVIK<span>AI</span></span></Link><button aria-label="Close sidebar" className="icon-button mobile-only" onClick={() => setSidebarOpen(false)}><X /></button></div><button className="new-chat-button" onClick={() => { createConversation(); setSidebarOpen(false); }}><MessageSquarePlus /> New conversation <span>⌘ K</span></button><label className="chat-search"><Search /><input aria-label="Search conversations" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a conversation" /></label><div className="history-label">RECENTLY IN ORBIT <MoreHorizontal /></div><div className="chat-history">{filteredChats.map((chat) => <button className={`history-item${chat.id === activeId ? " history-active" : ""}`} key={chat.id} onClick={() => { setActive(chat.id); setSidebarOpen(false); }}><span className="history-dot" />{chat.title}</button>)}{filteredChats.length === 0 && <span className="history-empty">Your conversations will gather here.</span>}</div><div className="sidebar-bottom"><Link href="/image"><ImagePlus /> Create something</Link><Link href="/library"><Sparkles/> Prompt library</Link><Link href="/settings"><span className="profile-orb">A</span><span><b>Your space</b><small>Personal universe</small></span><MoreHorizontal className="profile-more" /></Link></div></aside>
    {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
    <section className="chat-main"><header className="chat-topbar"><button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu /></button><div className="workspace-title"><span className="workspace-title-icon"><Sparkles /></span><span>ANVIK <small>PERSONAL AI</small></span></div><label className="mode-select"><span>MODE</span><select aria-label="AI mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>{modes.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></header>
      <div className={`conversation${activeMessages.length ? " conversation-populated" : ""}`}>
        {activeMessages.length === 0 ? <div className="welcome-state"><div className="welcome-orb"><Orb size="small" /></div><div className="welcome-kicker"><span /> READY WHEN YOU ARE</div><h1>Where should we<br /><span className="gradient-text">take this thought?</span></h1><p>A question, a half-formed idea, a curious detour. Start anywhere.</p><div className="prompt-grid">{promptIdeas.map(({ icon, title, text }) => <button className="prompt-card" key={title} onClick={() => void sendMessage(text)}><span className="prompt-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><ArrowUpRight className="prompt-arrow" /></button>)}</div></div> : <div className="message-list">{activeMessages.map((message) => <article className={`message-row message-${message.role}`} key={message.id}><div className="message-avatar">{message.role === "assistant" ? <span>A</span> : "Y"}</div><div className="message-content"><span className="message-byline">{message.role === "assistant" ? "ANVIK" : "YOU"}</span><p>{message.content || (pending ? "ANVIK is thinking..." : "")}</p>{message.role === "assistant" && message.content && <button className="message-copy" onClick={() => { void navigator.clipboard.writeText(message.content); setCopied(message.id); window.setTimeout(() => setCopied(null), 1500); }} aria-label="Copy response">{copied === message.id ? <Check /> : <Copy />}{copied === message.id ? "Copied" : "Copy"}</button>}</div></article>)}{pending && <div className="thinking-indicator"><span className="thinking-dot" /><span>ANVIK is thinking...</span></div>}<div ref={endRef} /></div>}
      </div>
      <div className="composer-dock"><form className="chat-composer" onSubmit={submit}><textarea ref={fieldRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={keySubmit} placeholder="Ask ANVIK anything..." aria-label="Message ANVIK" rows={1} disabled={pending} /><div className="composer-controls"><div className="composer-tools"><button type="button" className="composer-tool" onClick={() => document.getElementById("anvik-files")?.click()} aria-label="Attach a file"><Paperclip /></button><button type="button" className="composer-tool" onClick={listen} aria-label="Use voice input"><Mic /></button><input id="anvik-files" hidden type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).map((file) => file.name))} /></div><div className="composer-hint">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "ENTER TO SEND · SHIFT + ENTER FOR A NEW LINE"}<button type="submit" className="send-button" aria-label="Send message" disabled={!input.trim() || pending}>{pending ? <AudioLines /> : <ArrowUp />}</button></div></div></form>{error && <p className="chat-error" role="status">{error}</p>}<div className="composer-disclaimer">ANVIK CAN MAKE MISTAKES. KEEP YOUR CURIOSITY, CHECK IMPORTANT DETAILS.</div></div>
    </section>
  </div>;
}
