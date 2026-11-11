// Offline-aware versions of the server actions. Client components import from here instead of "@/app/…-actions".
// Changes made without internet go to the outbox (src/lib/offline/outbox.ts) and are sent when the connection is back.
// Actions that need the server or AI to produce something (refresh, AI help, Plan My Day) say so instead.
import * as tasks from "@/app/actions";
import * as academics from "@/app/academics-actions";
import * as edge from "@/app/edge-actions";
import { applyOfflineChange } from "@/app/offline-actions";
import { isNetworkError, outbox, pack } from "./outbox";

type Fn = (...args: never[]) => Promise<unknown>;

/** Used by the sync: sends a stored change with its one-time id, so it is applied once even if sent twice */
export const runStored = (id: string, name: string, args: unknown[]) => applyOfflineChange(id, name, args);

const online = () => typeof navigator === "undefined" || navigator.onLine;
const field = (f: unknown, k: string) => (f instanceof FormData ? String(f.get(k) ?? "").slice(0, 60) : "");
const q = (s: string) => (s ? ` “${s.slice(0, 60)}”` : "");

function queued<F extends Fn>(
  name: string,
  fn: F,
  label: (...a: Parameters<F>) => string,
  opts: { key?: (...a: Parameters<F>) => string | null; offline?: (...a: Parameters<F>) => Awaited<ReturnType<F>> } = {}
) {
  return (async (...args: Parameters<F>) => {
    const keep = () => {
      outbox.add({ name, args: pack(args), label: label(...args), key: opts.key?.(...args) ?? null });
      return opts.offline ? opts.offline(...args) : undefined;
    };
    // offline, or older changes still waiting: store it so everything reaches the server in order
    if (!online() || outbox.list().some((e) => !e.error)) return keep();
    try {
      return await fn(...args);
    } catch (e) {
      if (isNetworkError(e)) return keep();
      throw e;
    }
  }) as unknown as F;
}

/** For actions that only make sense online: a clear answer instead of an error screen */
function needsInternet<F extends Fn>(fn: F, offline: (...a: Parameters<F>) => Awaited<ReturnType<F>>) {
  return (async (...args: Parameters<F>) => {
    if (!online()) return offline(...args);
    try {
      return await fn(...args);
    } catch (e) {
      if (isNetworkError(e)) return offline(...args);
      throw e;
    }
  }) as unknown as F;
}
const NEEDS_NET = "You're offline. This needs internet.";

/* ---------------- tasks, attention, day plan, documents, plans, timetable ---------------- */

export const createTaskAction = queued("createTaskAction", tasks.createTaskAction, (f) => `Add task${q(field(f, "title"))}`);
export const updateTaskAction = queued("updateTaskAction", tasks.updateTaskAction, (_id, f) => `Edit task${q(field(f, "title"))}`, { key: (id) => `task:${id}` });
export const toggleTaskAction = queued("toggleTaskAction", tasks.toggleTaskAction, (_id, done) => (done ? "Tick off a task" : "Reopen a task"), { key: (id) => `task-done:${id}` });
export const deleteTaskAction = queued("deleteTaskAction", tasks.deleteTaskAction, () => "Delete a task");
export const addAttentionAction = queued("addAttentionAction", tasks.addAttentionAction, (f) => `Flag${q(field(f, "title"))}`);
export const resolveAttentionAction = queued("resolveAttentionAction", tasks.resolveAttentionAction, () => "Clear a flagged item");
export const attentionToTaskAction = queued("attentionToTaskAction", tasks.attentionToTaskAction, (_id, title) => `Turn${q(title)} into a task`);
export const savePlanAction = queued("savePlanAction", tasks.savePlanAction, (day) => `Save the plan for ${day}`, { key: (day) => `dayplan:${day}` });
export const clearPlanAction = queued("clearPlanAction", tasks.clearPlanAction, (day) => `Clear the plan for ${day}`, { key: (day) => `dayplan:${day}` });
export const saveDayWindowAction = queued("saveDayWindowAction", tasks.saveDayWindowAction, () => "Change your day routine", { key: () => "day-window" });
export const saveDocAction = queued("saveDocAction", tasks.saveDocAction, (_id, title) => `Edit document${q(title)}`, { key: (id) => `doc:${id}` });
export const saveBusinessPlanAction = queued("saveBusinessPlanAction", tasks.saveBusinessPlanAction, (_id, title) => `Edit plan${q(title)}`, { key: (id) => `plan:${id}` });
export const addTimetableSlotAction = queued("addTimetableSlotAction", tasks.addTimetableSlotAction, (f) => `Add${q(field(f, "title"))} to the timetable`);
export const deleteTimetableSlotAction = queued("deleteTimetableSlotAction", tasks.deleteTimetableSlotAction, () => "Remove a timetable slot");

// these need the server: a new document or plan gets its id there, and Plan My Day is computed there
export const generatePlanAction = tasks.generatePlanAction;
export const deleteDocAction = tasks.deleteDocAction;
export const deletePlanAction = tasks.deletePlanAction;

/* ---------------- academics ---------------- */

export const createSubjectAction = queued("createSubjectAction", academics.createSubjectAction, (i) => `Add subject${q(i.name)}`, { offline: () => null });
export const updateSubjectAction = queued("updateSubjectAction", academics.updateSubjectAction, () => "Edit a subject");
export const deleteSubjectAction = queued("deleteSubjectAction", academics.deleteSubjectAction, () => "Delete a subject");
export const addTopicAction = queued("addTopicAction", academics.addTopicAction, (_s, title) => `Add topic${q(title)}`);
export const setTopicStatusAction = queued("setTopicStatusAction", academics.setTopicStatusAction, (_id, status) => `Set a topic to ${status.replace("_", " ")}`, { key: (id) => `topic:${id}` });
export const deleteTopicAction = queued("deleteTopicAction", academics.deleteTopicAction, () => "Remove a topic");
export const createApplicationAction = queued("createApplicationAction", academics.createApplicationAction, (i) => `Add university${q(i.university ?? "")}`);
export const updateApplicationAction = queued("updateApplicationAction", academics.updateApplicationAction, () => "Edit a university application");
export const saveApplicationStepsAction = queued("saveApplicationStepsAction", academics.saveApplicationStepsAction, () => "Update application steps", { key: (id) => `steps:${id}` });
export const deleteApplicationAction = queued("deleteApplicationAction", academics.deleteApplicationAction, () => "Remove a university");
export const createNoteAction = queued("createNoteAction", academics.createNoteAction, (i) => `Add note${q(i.title)}`);
export const updateNoteAction = queued("updateNoteAction", academics.updateNoteAction, (_id, i) => `Edit note${q(i.title)}`, { key: (id) => `note:${id}` });
export const deleteNoteAction = queued("deleteNoteAction", academics.deleteNoteAction, () => "Delete a note");

/* ---------------- daily edge ---------------- */

export const saveItemAction = queued("saveItemAction", edge.saveItemAction, (_id, saved) => (saved ? "Save an article" : "Unsave an article"), { key: (id) => `saved:${id}` });
export const readItemAction = queued("readItemAction", edge.readItemAction, (_id, read) => (read ? "Mark an article read" : "Mark an article unread"), { key: (id) => `read:${id}` });
export const takeawayAction = queued("takeawayAction", edge.takeawayAction, (_id, text) => `Takeaway${q(text)}`, { key: (id) => `takeaway:${id}` });
export const feedbackAction = queued("feedbackAction", edge.feedbackAction, (_id, s) => (s === 1 ? "More like this" : "Less like this"));
export const learnedAction = queued("learnedAction", edge.learnedAction, () => "Schedule reviews", { offline: () => true });
export const reviewAction = queued("reviewAction", edge.reviewAction, (_id, got) => (got ? "Review: remembered" : "Review: missed"));
export const saveEdgeSettingsAction = queued("saveEdgeSettingsAction", edge.saveEdgeSettingsAction, () => "Change Daily Edge settings", { key: () => "edge-settings", offline: (s) => s });
export const toggleSourceAction = queued("toggleSourceAction", edge.toggleSourceAction, (_id, on) => (on ? "Turn a source on" : "Turn a source off"), { key: (id) => `source:${id}` });
export const removeSourceAction = queued("removeSourceAction", edge.removeSourceAction, () => "Remove a feed");

export const refreshEdgeAction = needsInternet(edge.refreshEdgeAction, () => ({ status: "busy" as const, reason: "You're offline. Refreshing needs internet." }));
export const weeklyAction = needsInternet(edge.weeklyAction, () => ({ ok: false as const, error: NEEDS_NET }));
export const simplerAction = needsInternet(edge.simplerAction, () => ({ ok: false as const, error: NEEDS_NET }));
export const connectAction = needsInternet(edge.connectAction, () => ({ ok: false as const, error: NEEDS_NET }));
export const addSourceAction = needsInternet(edge.addSourceAction, () => ({ ok: false as const, error: "You're offline. Adding a feed needs internet so it can be checked." }));
export const checkSourcesAction = needsInternet(edge.checkSourcesAction, async () => undefined);
