"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/server/auth";
import * as academics from "@/lib/server/academics";
import type { AppStep } from "@/lib/academics";

// Server actions for the Academics pages. Each one checks the session, writes, and refreshes the pages.
const refresh = () => revalidatePath("/", "layout");

/* ---------------- subjects and topics ---------------- */

export async function createSubjectAction(input: { name: string; level: string; color: string }) {
  await requireSession();
  const id = await academics.createSubject(input);
  refresh();
  return id;
}

export async function updateSubjectAction(id: string, input: academics.SubjectInput) {
  await requireSession();
  await academics.updateSubject(id, input);
  refresh();
}

export async function deleteSubjectAction(id: string) {
  await requireSession();
  await academics.deleteSubject(id);
  refresh();
}

export async function addTopicAction(subjectId: string, title: string) {
  await requireSession();
  await academics.addTopic(subjectId, title);
  refresh();
}

export async function setTopicStatusAction(id: string, status: string) {
  await requireSession();
  await academics.setTopicStatus(id, status);
  refresh();
}

export async function deleteTopicAction(id: string) {
  await requireSession();
  await academics.deleteTopic(id);
  refresh();
}

/* ---------------- university applications ---------------- */

export async function createApplicationAction(input: academics.ApplicationInput) {
  await requireSession();
  await academics.createApplication(input);
  refresh();
}

export async function updateApplicationAction(id: string, input: academics.ApplicationInput) {
  await requireSession();
  await academics.updateApplication(id, input);
  refresh();
}

export async function saveApplicationStepsAction(id: string, steps: AppStep[]) {
  await requireSession();
  await academics.updateApplication(id, { steps });
  refresh();
}

export async function deleteApplicationAction(id: string) {
  await requireSession();
  await academics.deleteApplication(id);
  refresh();
}

/* ---------------- notes ---------------- */

export async function createNoteAction(input: { title: string; body: string; subjectId: string | null }) {
  await requireSession();
  await academics.createNote(input);
  refresh();
}

export async function updateNoteAction(id: string, input: { title: string; body: string; subjectId: string | null }) {
  await requireSession();
  await academics.updateNote(id, input);
  refresh();
}

export async function deleteNoteAction(id: string) {
  await requireSession();
  await academics.deleteNote(id);
  refresh();
}
