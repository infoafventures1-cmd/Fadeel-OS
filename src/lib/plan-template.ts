// The sections a new University Business Plan starts with, and the hint shown in each empty one.
export const PLAN_SECTIONS: [title: string, hint: string][] = [
  ["Executive summary", "The whole plan in a few short paragraphs: the problem, your solution, who pays, traction so far, and what you need."],
  ["Problem", "Who has this problem, how often, and what it costs them today. Use real observations from where you're starting."],
  ["Solution", "What you're building and how it solves the problem. Keep it concrete: what does a customer actually do?"],
  ["Target customers", "Your first customers, described specifically. Who buys, who uses it, and how you'll reach the first 100."],
  ["Market size", "How many potential customers there are and what they spend. Show the maths and mark estimates."],
  ["Competition", "Who else solves this, including the informal ways people cope now. Why customers will pick you."],
  ["Business model & pricing", "How you make money, prices in KES, and the margin on each sale."],
  ["Go-to-market", "How you'll win the first customers: channels, partnerships, launch plan."],
  ["Operations", "What it takes to deliver every day: suppliers, tools, people, location."],
  ["Team", "Who's involved, what each person does, and why you're the right people."],
  ["Financials", "Startup costs, monthly costs, a 12-month revenue forecast and when you break even. All in KES."],
  ["Risks", "The biggest things that could go wrong, and how you'll reduce each one."],
  ["Milestones", "What you'll achieve in the next 3, 6 and 12 months."],
  ["Funding ask", "How much you need, what it pays for, and what the funder gets."],
];

export const PLAN_HINT: Record<string, string> = Object.fromEntries(PLAN_SECTIONS);

export interface PlanSection {
  id: string;
  title: string;
  content: string;
}

export interface PlanChatMsg {
  role: "user" | "assistant";
  content: string;
  model?: string;
  sources?: string[];
  error?: boolean;
}

export interface Plan {
  id: string;
  title: string;
  idea: string;
  sections: PlanSection[];
  chat: PlanChatMsg[];
  updatedAt: string;
}

export const sectionId = () => Math.random().toString(36).slice(2, 8);

export const planToMarkdown = (p: Pick<Plan, "title" | "idea" | "sections">) =>
  `# ${p.title}\n\n${p.idea ? `_${p.idea}_\n\n` : ""}` + p.sections.map((s) => `## ${s.title}\n\n${s.content.trim()}`).join("\n\n") + "\n";
