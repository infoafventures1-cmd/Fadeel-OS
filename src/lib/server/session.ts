import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Single-user login: DASHBOARD_PASSCODE unlocks a signed, httpOnly session cookie.
export const SESSION_COOKIE = "os_session";
export const SESSION_DAYS = 60;

/** The two things the dashboard can't run without. /setup explains how to add them. */
export const missingEnv = () => ["DATABASE_URL", "DASHBOARD_PASSCODE"].filter((k) => !process.env[k]);

// AUTH_SECRET is optional. Without it the signing key comes from the passcode and the database URL
// (both secret), which also means changing the passcode signs every device out.
function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  return createHash("sha256").update(`session:${process.env.DASHBOARD_PASSCODE}:${process.env.DATABASE_URL}`).digest("hex");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createSessionToken() {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  return `${exp}.${sign(String(exp))}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

export function checkPasscode(input: string) {
  const expected = process.env.DASHBOARD_PASSCODE;
  if (!expected) return false;
  return safeEqual(input.trim(), expected);
}
