import { redirect } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { Mark, AppName } from "@/components/brand/mark";
import { GlassCard } from "@/components/ui/glass-card";
import { APP_NAME } from "@/config";
import { missingEnv } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: `Set up · ${APP_NAME}` };

// Shown on a fresh deployment until the database and the password exist. Never shows any values, only what is missing.
export default function SetupPage() {
  const missing = missingEnv();
  if (missing.length === 0) redirect("/home");

  const steps = [
    {
      key: "DATABASE_URL",
      title: "Add a database",
      body: "In your Vercel project open Storage, choose Create Database, pick Neon (Postgres, free plan) and connect it to this project. Vercel adds DATABASE_URL for you. The tables create themselves on first use.",
    },
    {
      key: "DASHBOARD_PASSCODE",
      title: "Choose a password",
      body: "In Settings › Environment Variables add DASHBOARD_PASSCODE with a long password of your own. It is the only thing between the internet and your dashboard.",
    },
  ];

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[520px]">
        <Mark size={40} className="text-foreground" />
        <h1 className="mt-5 text-[30px] font-semibold leading-none">
          Two steps to switch <AppName /> on.
        </h1>
        <p className="mt-3 text-[13px] text-muted">The code is deployed. It needs somewhere to keep your data and a password.</p>

        <div className="mt-6 space-y-2.5">
          {steps.map((s, i) => {
            const done = !missing.includes(s.key);
            return (
              <GlassCard key={s.key} hover={false} className="flex gap-3 p-4">
                {done ? <Check size={16} className="mt-0.5 shrink-0 text-emerald" /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted-2" />}
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-foreground">
                    {i + 1}. {s.title} <span className="ml-1 font-mono text-[10.5px] text-muted-2">{s.key}</span>
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{done ? "Done." : s.body}</p>
                </div>
              </GlassCard>
            );
          })}
        </div>
        <p className="mt-5 text-[12.5px] leading-relaxed text-muted">
          Then redeploy (Deployments › ⋯ › Redeploy) so the new settings take effect, and reload this page.
        </p>
      </div>
    </main>
  );
}
