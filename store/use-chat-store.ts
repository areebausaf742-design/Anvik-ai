import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ModeId } from "@/lib/prompts";

export type MessageMeta = {
  /** every answer comes from the model; kept for old stored messages */
  source?: "gemini";
  /** the checker's verdict; absent means it was not checked */
  checked?: boolean;
  /** the checker had to repair or regenerate the answer */
  fixed?: boolean;
  /** short human label, e.g. "From memory · 0 credits used" */
  credit?: string;
  /** the user's verdict on this answer */
  verdict?: "like" | "dislike";
  /** "What should I have said?" was saved for this answer */
  taught?: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
} & MessageMeta;
export type Conversation = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };

type ChatStore = {
  conversations: Conversation[];
  activeId: string | null;
  mode: ModeId;
  temperature: number;
  storageWarning: string;
  setTemperature: (temperature: number) => void;
  createConversation: () => string;
  setActive: (id: string) => void;
  setMode: (mode: ModeId) => void;
  addMessage: (id: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  setMessageMeta: (conversationId: string, messageId: string, meta: MessageMeta) => void;
  clearHistory: () => void;
};

/** Caps so localStorage can never silently stop accepting new messages. */
const MAX_CONVERSATIONS = 40;
const MAX_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 24_000;

/**
 * Trim before persisting: newest conversations first, newest messages last,
 * with long answers clipped. Without a ceiling the store throws on write and
 * new messages simply stop saving (audit M-8).
 */
function trim(conversations: Conversation[]): Conversation[] {
  return [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS)
    .map((chat) => ({
      ...chat,
      messages: chat.messages.slice(-MAX_MESSAGES).map((message) =>
        message.content.length > MAX_MESSAGE_CHARS
          ? { ...message, content: `${message.content.slice(0, MAX_MESSAGE_CHARS)}\n\n_…truncated to save space_` }
          : message,
      ),
    }));
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      conversations: [],
      activeId: null,
      mode: "smart",
      temperature: 0.65,
      storageWarning: "",
      setTemperature: (temperature) => set({ temperature }),
      createConversation: () => {
        const id = crypto.randomUUID();
        set((state) => ({
          activeId: id,
          conversations: [{ id, title: "New conversation", updatedAt: Date.now(), messages: [] }, ...state.conversations],
        }));
        return id;
      },
      setActive: (activeId) => set({ activeId }),
      setMode: (mode) => set({ mode }),
      addMessage: (id, message) =>
        set((state) => ({
          conversations: state.conversations.map((chat) =>
            chat.id === id
              ? {
                  ...chat,
                  title:
                    chat.messages.length === 0 && message.role === "user"
                      ? message.content.slice(0, 46)
                      : chat.title,
                  updatedAt: Date.now(),
                  messages: [...chat.messages, message],
                }
              : chat,
          ),
        })),
      updateMessage: (conversationId, messageId, content) =>
        set((state) => ({
          conversations: state.conversations.map((chat) =>
            chat.id === conversationId
              ? {
                  ...chat,
                  messages: chat.messages.map((message) =>
                    message.id === messageId ? { ...message, content } : message,
                  ),
                }
              : chat,
          ),
        })),
      setMessageMeta: (conversationId, messageId, meta) =>
        set((state) => ({
          conversations: state.conversations.map((chat) =>
            chat.id === conversationId
              ? {
                  ...chat,
                  messages: chat.messages.map((message) =>
                    message.id === messageId ? { ...message, ...meta } : message,
                  ),
                }
              : chat,
          ),
        })),
      clearHistory: () => set({ conversations: [], activeId: null, storageWarning: "" }),
    }),
    {
      name: "anvik-chat-history",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ conversations, activeId, mode, temperature }) => ({
        conversations: trim(conversations),
        activeId,
        mode,
        temperature,
      }),
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<ChatStore>;
        return {
          ...state,
          conversations: trim(Array.isArray(state.conversations) ? state.conversations : []),
        } as ChatStore;
      },
    },
  ),
);

export const selectActiveConversation = (state: ChatStore) =>
  state.conversations.find((chat) => chat.id === state.activeId) ?? null;
