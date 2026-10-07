"use server";

import { cookies, headers } from "next/headers";
import { sql } from "@/lib/server/db";
import { redirect } from "next/navigation";
import { checkPasscode, createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/server/session";

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login") ? n : "/home";
}

const MAX_FAILURES = 8;
const WINDOW = "15 minutes";

export async function login(_prev: { error?: string } | undefined, form: FormData) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const [{ n }] = await sql`select count(*)::int as n from login_failures where ip = ${ip} and at > now() - ${WINDOW}::interval`;
  if (Number(n) >= MAX_FAILURES) return { error: "Too many wrong attempts. Try again in 15 minutes." };

  const passcode = String(form.get("passcode") ?? "");
  if (!checkPasscode(passcode)) {
    await sql`insert into login_failures (ip) values (${ip})`;
    await sql`delete from login_failures where at < now() - interval '1 day'`;
    await new Promise((r) => setTimeout(r, 900)); // slow down guessing
    return { error: "That password isn't right." };
  }
  await sql`delete from login_failures where ip = ${ip}`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
