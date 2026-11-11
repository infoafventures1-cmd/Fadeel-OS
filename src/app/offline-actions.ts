"use server";

import { requireSession } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import * as tasks from "./actions";
import * as academics from "./academics-actions";
import * as edge from "./edge-actions";

// Applies a change that was made offline and stored on the device. Each change carries a one-time id: the
// receipt is recorded first, so if the same change arrives twice (e.g. the app was closed mid-sync and sent
// it again) it is applied only once.
const ALLOWED: Record<string, (...args: never[]) => Promise<unknown>> = {
  createTaskAction: tasks.createTaskAction,
  updateTaskAction: tasks.updateTaskAction,
  toggleTaskAction: tasks.toggleTaskAction,
  deleteTaskAction: tasks.deleteTaskAction,
  addAttentionAction: tasks.addAttentionAction,
  resolveAttentionAction: tasks.resolveAttentionAction,
  attentionToTaskAction: tasks.attentionToTaskAction,
  savePlanAction: tasks.savePlanAction,
  clearPlanAction: tasks.clearPlanAction,
  saveDayWindowAction: tasks.saveDayWindowAction,
  saveDocAction: tasks.saveDocAction,
  saveBusinessPlanAction: tasks.saveBusinessPlanAction,
  addTimetableSlotAction: tasks.addTimetableSlotAction,
  deleteTimetableSlotAction: tasks.deleteTimetableSlotAction,
  createSubjectAction: academics.createSubjectAction,
  updateSubjectAction: academics.updateSubjectAction,
  deleteSubjectAction: academics.deleteSubjectAction,
  addTopicAction: academics.addTopicAction,
  setTopicStatusAction: academics.setTopicStatusAction,
  deleteTopicAction: academics.deleteTopicAction,
  createApplicationAction: academics.createApplicationAction,
  updateApplicationAction: academics.updateApplicationAction,
  saveApplicationStepsAction: academics.saveApplicationStepsAction,
  deleteApplicationAction: academics.deleteApplicationAction,
  createNoteAction: academics.createNoteAction,
  updateNoteAction: academics.updateNoteAction,
  deleteNoteAction: academics.deleteNoteAction,
  saveItemAction: edge.saveItemAction,
  readItemAction: edge.readItemAction,
  takeawayAction: edge.takeawayAction,
  feedbackAction: edge.feedbackAction,
  learnedAction: edge.learnedAction,
  reviewAction: edge.reviewAction,
  saveEdgeSettingsAction: edge.saveEdgeSettingsAction,
  toggleSourceAction: edge.toggleSourceAction,
  removeSourceAction: edge.removeSourceAction,
};

/** FormData travels as its entries; rebuild it here */
function unpack(args: unknown[]) {
  return args.map((a) => {
    if (a && typeof a === "object" && !Array.isArray(a) && "__formdata" in a) {
      const f = new FormData();
      for (const [k, v] of (a as { __formdata: [string, string][] }).__formdata) f.append(String(k), String(v));
      return f;
    }
    return a;
  });
}

export async function applyOfflineChange(id: string, name: string, args: unknown[]) {
  await requireSession();
  const fn = ALLOWED[name];
  if (!fn || !/^[a-z0-9]{6,20}$/.test(id) || !Array.isArray(args)) throw new Error("Unknown change");
  const [fresh] = await sql`insert into offline_receipts (id, name) values (${id}, ${name}) on conflict (id) do nothing returning id`;
  if (!fresh) return { ok: true as const, duplicate: true };
  try {
    await (fn as (...a: unknown[]) => Promise<unknown>)(...unpack(args));
  } catch (e) {
    // not applied: forget the receipt so a retry can apply it
    await sql`delete from offline_receipts where id = ${id}`;
    throw e;
  }
  return { ok: true as const, duplicate: false };
}
