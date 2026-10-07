import { sql } from "./db";

export interface Doc {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

const toDoc = (r: Record<string, unknown>): Doc => ({
  id: String(r.id),
  title: String(r.title),
  content: String(r.content ?? ""),
  updatedAt: new Date(r.updated_at as string).toISOString(),
});

export async function listDocs() {
  const rows = await sql`select id, title, left(content, 220) as content, updated_at, length(content) as chars from documents order by updated_at desc`;
  return rows.map((r) => ({ ...toDoc(r), chars: Number(r.chars) }));
}

export async function getDoc(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await sql`select * from documents where id = ${id}`;
  return row ? toDoc(row) : null;
}

export async function createDoc(title = "Untitled", content = "") {
  const [row] = await sql`insert into documents (title, content) values (${title}, ${content}) returning *`;
  return toDoc(row);
}

export async function saveDoc(id: string, title: string, content: string) {
  await sql`update documents set title = ${title.slice(0, 200) || "Untitled"}, content = ${content.slice(0, 400_000)}, updated_at = now() where id = ${id}`;
}

export async function deleteDoc(id: string) {
  await sql`delete from documents where id = ${id}`;
}
