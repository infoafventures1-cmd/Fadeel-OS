import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export * from "./session";

/** For server actions and route handlers: throws unless the request carries a valid session. */
export async function requireSession() {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) throw new Error("Not signed in");
}
