export const promptIdeas = [
  { icon: "", title: "Understand a form", text: "My PM-KISAN instalment has not arrived. What do I check first?" },
  { icon: "", title: "Deal with a notice", text: "A GST notice arrived. What is the deadline and what do I send back?" },
  { icon: "", title: "Write it clearly", text: "Turn my rough notes into a short, confident email to my landlord." },
  { icon: "", title: "Plan the week", text: "Help me plan a realistic week around three priorities and a 9-to-6 job." },
];

export const promptLibrary = [
  "Explain a hard topic simply",
  "Write a concise executive summary",
  "Debug this code step by step",
  "Brainstorm ten distinctive names",
  "Draft a warm, professional email",
  "Turn notes into an action plan",
  "Create a 30-day learning roadmap",
  "Review this idea for blind spots",
  "Write a product launch plan",
  "Summarize this for a busy reader",
  "Design a clear API contract",
  "Improve this paragraph without changing its voice",
  "Compare these options fairly",
  "Create a meeting agenda",
  "Write an engaging short story",
  "Generate test cases for this function",
  "Outline a persuasive presentation",
  "Break a goal into weekly milestones",
  "Suggest accessible UI improvements",
  "Translate jargon into plain language",
  "Create a customer interview guide",
  "Find the simplest next step",
  "Make this message more empathetic",
  "Teach me with a practical example",
];

export const modes = [
  { id: "fast", label: "Fast", hint: "Quick answers" },
  { id: "smart", label: "Smart", hint: "Deep thinking" },
  { id: "creative", label: "Creative", hint: "Fresh perspectives" },
  { id: "coder", label: "Coder", hint: "Code & logic" },
] as const;

export type ModeId = (typeof modes)[number]["id"];
