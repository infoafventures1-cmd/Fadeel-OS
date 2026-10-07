import { APP_NAME } from "@/config";

// FD monogram with an accent dot. public/mark.svg is the same drawing for the browser tab.
export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 44 36" width={(size * 44) / 36} height={size} className={className} aria-hidden="true">
      {/* F */}
      <path d="M2 2h15v5H8v6h8v5H8v16H2z" fill="currentColor" />
      {/* D */}
      <path d="M19 2h7c8.3 0 14 6.2 14 16s-5.7 16-14 16h-7zM25 7.5v21h1c4.7 0 8-4 8-10.5S30.7 7.5 26 7.5z" fill="currentColor" fillRule="evenodd" />
      {/* dot */}
      <circle cx="40" cy="32" r="3.2" fill="var(--accent)" />
    </svg>
  );
}

/** APP_NAME with its last word in the accent colour: FADEEL <em>OS</em> */
export function AppName({ accent: Accent = "em" }: { accent?: "em" | "span" }) {
  const words = APP_NAME.trim().split(/\s+/);
  const last = words.pop();
  return (
    <>
      {words.join(" ")} {Accent === "em" ? <em>{last}</em> : <span className="text-accent">{last}</span>}
    </>
  );
}
