export const promptIdeas = [
  { icon: "✳", title: "Untangle a big idea", text: "Explain quantum computing like I’m curious, not a physicist." },
  { icon: "⌘", title: "Make something useful", text: "Help me plan a focused, realistic week around my top priorities." },
  { icon: "↗", title: "Write with clarity", text: "Turn my rough notes into a clear, confident announcement." },
  { icon: "⌁", title: "Build a first draft", text: "Create a thoughtful 30-day launch plan for a new creative project." },
];

export const promptLibrary = [
  "Explain a hard topic simply", "Write a concise executive summary", "Debug this code step by step", "Brainstorm ten distinctive names", "Draft a warm, professional email", "Turn notes into an action plan", "Create a 30-day learning roadmap", "Review this idea for blind spots", "Write a product launch plan", "Summarize this for a busy reader", "Design a clear API contract", "Improve this paragraph without changing its voice", "Compare these options fairly", "Create a meeting agenda", "Write an engaging short story", "Generate test cases for this function", "Outline a persuasive presentation", "Break a goal into weekly milestones", "Suggest accessible UI improvements", "Translate jargon into plain language", "Create a customer interview guide", "Find the simplest next step", "Make this message more empathetic", "Teach me with a practical example",
];

export const modes = [
  { id: "fast", label: "Fast", hint: "Quick answers" },
  { id: "smart", label: "Smart", hint: "Deep thinking" },
  { id: "creative", label: "Creative", hint: "Fresh perspectives" },
  { id: "coder", label: "Coder", hint: "Code & logic" },
] as const;

export type ModeId = (typeof modes)[number]["id"];
