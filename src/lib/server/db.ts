import { neon } from "@neondatabase/serverless";
import { SCHEMA } from "./schema";

let client: ReturnType<typeof neon> | null = null;
let ready: Promise<unknown> | null = null;

/** Tagged-template SQL against Neon: await sql`select * from tasks where id = ${id}` */
export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  const db = client;
  // Create the tables before the first query, so there is no migration step to run by hand
  ready ??= db.transaction(SCHEMA.map((statement) => db.query(statement))).catch((e) => {
    ready = null;
    throw e;
  });
  return ready.then(() => db(strings, ...values)) as Promise<Record<string, unknown>[]>;
}
