import { Mark, AppName } from "@/components/brand/mark";
import { APP_NAME, OWNER } from "@/config";
import { LoginForm } from "./login-form";

export const metadata = { title: `Sign in · ${APP_NAME}` };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="flex w-full max-w-[360px] flex-col items-center text-center">
        <Mark size={56} className="text-foreground" />
        <h1 className="mt-6 text-[34px] font-semibold leading-none">
          <AppName />
        </h1>
        <p className="mt-3 text-[13px] text-muted">{OWNER.firstName}&apos;s private command center.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
