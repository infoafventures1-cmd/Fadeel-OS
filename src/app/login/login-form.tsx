"use client";

import { useActionState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { login } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-8 w-full">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.14em] text-muted-2" htmlFor="passcode">
        Password
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-hairline bg-tint/[0.03] px-3 focus-within:border-accent/60">
        <Lock size={14} className="text-muted-2" />
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="h-12 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-2 focus:outline-none"
          placeholder="Password"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label="Sign in"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-dim disabled:opacity-60"
        >
          <ArrowRight size={15} />
        </button>
      </div>
      <p className="mt-3 h-5 text-[12.5px] text-rose" role="status">
        {state?.error}
      </p>
    </form>
  );
}
