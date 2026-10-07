import { AI_MODELS, ASSISTANT_NAME, OWNER, projectByKey } from "@/config";
import { requireSession } from "@/lib/server/auth";
import { AiError, complete, looseJson, modelStatus, type ChatMsg } from "@/lib/server/ai";
import { getSetting, listOpenTasks, setSetting } from "@/lib/server/data";
import { listDocs } from "@/lib/server/docs";
import { listApplications, listSubjects } from "@/lib/server/academics";
import { topicStatus } from "@/lib/academics";
import { cleanSections, getPlan, listPlans, savePlan, savePlanChat } from "@/lib/server/plans";
import { sectionId, type PlanChatMsg, type PlanSection } from "@/lib/plan-template";
import { formatDue, TZ } from "@/lib/time";

export const dynamic = "force-dynamic";
// AI answers can take a while, especially long plan drafts
export const maxDuration = 120;

const now = () =>
  new Date().toLocaleString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ABOUT = `${OWNER.firstName} is a student founder based in Mombasa, Kenya. He builds startups and is applying to university.`;

const STYLE = `Write plain, specific, confident English. Use KES for money unless told otherwise. Label estimates as estimates and never present invented statistics as facts.`;

type AssistantMsg = PlanChatMsg;
const label = (id: string) => AI_MODELS.find((m) => m.id === id)?.label ?? id;
const str = (v: unknown, max = 50_000) => String(v ?? "").slice(0, max);

export async function GET() {
  await requireSession();
  const history = await getSetting<AssistantMsg[]>("assistant_chat", []);
  return Response.json({ models: modelStatus(), history });
}

export async function POST(req: Request) {
  await requireSession();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const task = String(body.task ?? "");
  const modelId = String(body.modelId ?? "");
  try {
    if (task === "ping") return Response.json(await ping(modelId));
    if (task === "doc") return Response.json(await docHelp(modelId, body));
    if (task === "plan") return Response.json(await planChat(modelId, body));
    if (task === "chat") return Response.json(await assistant(modelId, body));
    if (task === "chat-clear") {
      await setSetting("assistant_chat", []);
      return Response.json({ history: [] });
    }
    return Response.json({ error: "Unknown request." }, { status: 400 });
  } catch (e) {
    const message = e instanceof AiError ? e.message : "Something went wrong on the server. Try again.";
    if (!(e instanceof AiError)) console.error(e);
    return Response.json({ error: message }, { status: e instanceof AiError ? 422 : 500 });
  }
}

/* ---------------- settings: test a model ---------------- */

async function ping(modelId: string) {
  const started = Date.now();
  try {
    const r = await complete(modelId, "Reply with the single word OK.", [{ role: "user", content: "Say OK." }]);
    return { ok: true, ms: Date.now() - started, via: r.via };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/* ---------------- documents: AI help ---------------- */

const DOC_ACTIONS: Record<string, string> = {
  improve: "Improve this writing: clearer, tighter and stronger. Keep the meaning, the facts and the writer's voice.",
  shorten: "Make this noticeably shorter, about half the length, keeping every key point.",
  expand: "Expand this with more detail, examples and explanation in the same voice. Roughly double the length.",
  grammar: "Fix spelling, grammar and punctuation only. Change nothing else.",
  formal: "Rewrite this in a more formal, professional tone.",
  simpler: "Rewrite this in simpler, plainer words that a 14-year-old would follow.",
  continue: "Continue writing from exactly where this text ends, in the same voice and format. Write only the next one to three paragraphs, not the text that is already there.",
  feedback: "Give honest, specific feedback on this writing: what works, what is weak, and the three changes that would help most. Use short '- ' bullet points.",
};

async function docHelp(modelId: string, b: Record<string, unknown>) {
  const action = String(b.action ?? "custom");
  const text = str(b.text, 60_000);
  const full = str(b.full, 30_000);
  const partial = Boolean(b.partial);
  const instruction = action === "custom" ? str(b.instruction, 2000).trim() : DOC_ACTIONS[action];
  if (!instruction) throw new AiError("Tell it what to do first.");
  if (!text.trim() && action !== "continue") throw new AiError("The document is empty. Write something first, or use Continue writing.");

  const rewrite = action !== "feedback";
  const system = [
    `You are the writing assistant inside FADEEL OS, ${OWNER.firstName}'s personal dashboard. ${ABOUT}`,
    STYLE,
    rewrite
      ? `Reply with ONLY the resulting text, ready to paste into the document: no introduction, no explanation, no quotation marks, no code fences. Keep the original's formatting (paragraphs, '- ' bullets). If the instruction is a question about the text rather than a change, answer it briefly instead.`
      : `Reply with your feedback only.`,
  ].join("\n\n");
  const user = [
    `Document title: ${str(b.title, 200) || "Untitled"}`,
    partial && full ? `The full document, for context only:\n"""\n${full}\n"""` : "",
    `${partial ? "The selected part to work on" : "The text to work on"}:\n"""\n${text || "(empty)"}\n"""`,
    `Instruction: ${instruction}`,
  ].filter(Boolean).join("\n\n");

  const r = await complete(modelId, system, [{ role: "user", content: user }]);
  return { text: r.text.trim().replace(/^```\w*\n?|\n?```$/g, ""), sources: r.sources, model: label(modelId) };
}

/* ---------------- University Business Plans: chat that edits the doc ---------------- */

function planPrompt(title: string, idea: string, sections: PlanSection[]) {
  const secs = sections.map((s) => `[section_id: ${s.id}] ${s.title}\n${s.content.trim().slice(0, 6000) || "(empty)"}`).join("\n\n");
  return `You are the AI co-writer inside FADEEL OS, helping ${OWNER.firstName} write a business plan for a university application or a university business competition. ${ABOUT}
Today is ${now()}.

Plan title: ${title}
The idea: ${idea || "(not written yet)"}

The plan as it stands now:

${secs}

How to work:
- When ${OWNER.firstName} asks you to write, add, change or remove anything, put the changes in "edits". Don't paste the section text into "reply".
- In "reply", say in one to three short sentences what you changed, or simply answer him if he only asked a question.
- Write the way a university admissions panel or competition judge would respect. Use "- " for bullet points. No markdown headings or bold inside sections.
- ${STYLE}
- If the idea is unclear, make a sensible assumption, say what you assumed, and keep going.

Reply with ONLY one JSON object and nothing else:
{"reply": "short message", "edits": []}
Each item in "edits" is one of:
{"action":"replace","section_id":"...","content":"..."}
{"action":"append","section_id":"...","content":"..."}
{"action":"add","title":"...","content":"...","after_section_id":"..."}
{"action":"delete","section_id":"..."}
{"action":"rename","title":"..."}
Leave "edits" empty when nothing in the plan should change.`;
}

async function planChat(modelId: string, b: Record<string, unknown>) {
  const id = String(b.id ?? "");
  const message = str(b.message, 4000).trim();
  const plan = await getPlan(id);
  if (!plan) throw new AiError("That plan no longer exists.");
  if (!message) throw new AiError("Type a message first.");

  // The browser sends what's on screen, so unsaved typing is included
  let title = str(b.title, 200) || plan.title;
  const idea = str(b.idea, 500);
  let sections = cleanSections(b.sections);
  await savePlan(id, title, idea, sections);

  const history: ChatMsg[] = plan.chat.filter((m) => m.content && !m.error).slice(-14).map((m) => ({ role: m.role, content: m.content }));
  const chat: PlanChatMsg[] = [...plan.chat, { role: "user", content: message }];

  let reply: PlanChatMsg;
  const changed: string[] = [];
  let count = 0;
  try {
    const r = await complete(modelId, planPrompt(title, idea, sections), [...history, { role: "user", content: message }]);
    const out = looseJson(r.text);
    if (out) {
      const edits = Array.isArray(out.edits) ? out.edits : [];
      for (const e of edits as Record<string, unknown>[]) {
        const sid = String(e?.section_id ?? "");
        const s = sections.find((x) => x.id === sid);
        const content = String(e?.content ?? "");
        if (e?.action === "replace" && s) { s.content = content; changed.push(s.id); count++; }
        else if (e?.action === "append" && s) { s.content = (s.content.trim() ? s.content.replace(/\s+$/, "") + "\n\n" : "") + content; changed.push(s.id); count++; }
        else if (e?.action === "add") {
          const ns = { id: sectionId(), title: String(e.title || "New section").slice(0, 120), content };
          const i = sections.findIndex((x) => x.id === String(e.after_section_id ?? ""));
          sections.splice(i >= 0 ? i + 1 : sections.length, 0, ns);
          changed.push(ns.id); count++;
        }
        else if (e?.action === "delete" && s) { sections = sections.filter((x) => x !== s); count++; }
        else if (e?.action === "rename" && e.title) { title = String(e.title).slice(0, 200); count++; }
      }
      reply = { role: "assistant", content: String(out.reply || (count ? "Done." : "")) || "Done.", model: label(modelId), sources: r.sources };
    } else {
      // The model answered in plain text instead of JSON: show it, change nothing
      reply = { role: "assistant", content: r.text.trim(), model: label(modelId), sources: r.sources };
    }
  } catch (e) {
    reply = { role: "assistant", content: e instanceof AiError ? e.message : "Something went wrong. Try again.", model: label(modelId), error: true };
  }

  chat.push(reply);
  if (count) await savePlan(id, title, idea, sections);
  await savePlanChat(id, chat);
  return { title, sections, chat: chat.slice(-60), changed, count };
}

/* ---------------- the assistant ---------------- */

async function assistant(modelId: string, b: Record<string, unknown>) {
  const message = str(b.message, 4000).trim();
  if (!message) throw new AiError("Type a message first.");
  const [history, tasks, plans, docs, subjects, applications] = await Promise.all([
    getSetting<AssistantMsg[]>("assistant_chat", []),
    listOpenTasks(),
    listPlans(),
    listDocs(),
    listSubjects(),
    listApplications(),
  ]);

  const taskLines = tasks.slice(0, 40).map((t) => `- ${t.title} [${projectByKey(t.project)?.name ?? t.project}, ${t.priority}${t.deadline ? `, due ${formatDue(t.deadline, t.deadlineHasTime)}` : ""}]`);
  const system = `You are ${ASSISTANT_NAME}, the AI assistant inside FADEEL OS, ${OWNER.firstName}'s personal command center. ${ABOUT}
It is now ${now()} (East Africa Time).

His open tasks (${tasks.length}):
${taskLines.join("\n") || "(none)"}

His University Business Plans: ${plans.map((p) => `${p.title} (${p.filled}/${p.total} sections written)`).join("; ") || "(none yet)"}
His documents: ${docs.slice(0, 20).map((d) => d.title).join("; ") || "(none yet)"}

His school subjects:
${subjects.map((s) => `- ${s.name} ${s.level}: grade ${s.currentGrade || "?"}, predicted ${s.predictedGrade || "?"}${s.nextAssessment ? `; next: ${s.nextAssessment}${s.nextAssessmentDate ? ` on ${s.nextAssessmentDate}` : ""}` : ""}; topics: ${s.topics.map((t) => `${t.title} (${topicStatus(t.status).label.toLowerCase()})`).join(", ") || "none"}`).join("\n") || "(none yet)"}

His university applications: ${applications.map((a) => `${a.university}${a.program ? ` (${a.program})` : ""}, ${a.tier}, deadline ${a.deadline ?? "not set"}, ${a.steps.filter((x) => x.done).length}/${a.steps.length} steps done`).join("; ") || "(none yet)"}

Help with anything: planning his day, studying, writing, research, business ideas, money and decisions. Be direct and practical, like a sharp friend who wants him to win. Keep answers short unless he asks for depth. Use '- ' bullets for lists. You can see his tasks above but can't change them; when something should become a task, say so and he can press C to capture it. ${STYLE}`;

  const prior: ChatMsg[] = history.filter((m) => m.content && !m.error).slice(-16).map((m) => ({ role: m.role, content: m.content }));
  let reply: AssistantMsg;
  try {
    const r = await complete(modelId, system, [...prior, { role: "user", content: message }]);
    reply = { role: "assistant", content: r.text.trim(), model: label(modelId), sources: r.sources };
  } catch (e) {
    reply = { role: "assistant", content: e instanceof AiError ? e.message : "Something went wrong. Try again.", model: label(modelId), error: true };
  }
  const next = [...history, { role: "user" as const, content: message }, reply].slice(-80);
  await setSetting("assistant_chat", next);
  return { history: next };
}
