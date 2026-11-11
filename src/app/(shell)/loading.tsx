// Shown instantly when you tap a page, while its data loads (instead of the screen freezing)
export default function Loading() {
  const bar = "rounded-md bg-tint/[0.07]";
  return (
    <div className="mx-auto max-w-[1000px] animate-pulse" aria-busy="true" aria-label="Loading">
      <div className={`${bar} h-8 w-48`} />
      <div className={`${bar} mt-3 h-4 w-72 max-w-full`} />
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-hairline bg-surface-raised p-5">
            <div className={`${bar} h-4 w-1/3`} />
            <div className={`${bar} mt-4 h-3 w-full`} />
            <div className={`${bar} mt-2 h-3 w-5/6`} />
            <div className={`${bar} mt-2 h-3 w-2/3`} />
          </div>
        ))}
      </div>
    </div>
  );
}
