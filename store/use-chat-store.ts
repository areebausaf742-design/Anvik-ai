import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ModeId } from "@/lib/prompts";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: number };
export type Conversation = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };
type ChatStore = {
  conversations: Conversation[];
  activeId: string | null;
  mode: ModeId;
  temperature: number;
  setTemperature: (temperature: number) => void;
  createConversation: () => string;
  setActive: (id: string) => void;
  setMode: (mode: ModeId) => void;
  addMessage: (id: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  clearHistory: () => void;
};

export const useChatStore = create<ChatStore>()(persist((set, get) => ({
  conversations: [], activeId: null, mode: "smart", temperature: 0.65,
  setTemperature: (temperature) => set({ temperature }),
  createConversation: () => {
    const id = crypto.randomUUID();
    set((state) => ({ activeId: id, conversations: [{ id, title: "New conversation", updatedAt: Date.now(), messages: [] }, ...state.conversations] }));
    return id;
  },
  setActive: (activeId) => set({ activeId }),
  setMode: (mode) => set({ mode }),
  addMessage: (id, message) => set((state) => ({ conversations: state.conversations.map((chat) => chat.id === id ? { ...chat, title: chat.messages.length === 0 && message.role === "user" ? message.content.slice(0, 42) : chat.title, updatedAt: Date.now(), messages: [...chat.messages, message] } : chat) })),
  updateMessage: (conversationId, messageId, content) => set((state) => ({ conversations: state.conversations.map((chat) => chat.id === conversationId ? { ...chat, messages: chat.messages.map((message) => message.id === messageId ? { ...message, content } : message) } : chat) })),
  clearHistory: () => set({ conversations: [], activeId: null }),
}), { name: "anvik-chat-history", storage: createJSONStorage(() => localStorage), partialize: ({ conversations, activeId, mode, temperature }) => ({ conversations, activeId, mode, temperature }) }));

export const selectActiveConversation = (state: ChatStore) => state.conversations.find((chat) => chat.id === state.activeId) ?? null;
