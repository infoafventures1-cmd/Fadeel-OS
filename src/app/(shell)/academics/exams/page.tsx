import Link from "next/link";
import { BookOpen } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { ExamCard } from "@/components/academics/exam-card";
import { listSubjects } from "@/lib/server/academics";
import { daysUntilDay } from "@/lib/academics";

export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  const subjects = await listSubjects();
  // Upcoming first, soonest at the top; anything more than a week past drops off
  const exams = subjects
    .filter((s) => s.nextAssessmentDate && daysUntilDay(s.nextAssessmentDate) >= -7)
    .sort((a, b) => a.nextAssessmentDate!.localeCompare(b.nextAssessmentDate!));
  const undated = subjects.filter((s) => !s.nextAssessmentDate);

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <h1 className="text-[30px] font-semibold leading-none">
          Exam <em>mode</em>
        </h1>
        <p className="mt-2 text-[13.5px] text-muted">Every subject with a test coming up, soonest first. Change a topic&apos;s confidence and the advice updates.</p>
      </div>

      {exams.length === 0 ? (
        <GlassCard hover={false} className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <BookOpen size={22} className="text-muted-2" />
          <p className="max-w-[420px] text-[13px] text-muted">
            No exams coming up. On the{" "}
            <Link href="/academics/school" className="text-accent underline-offset-2 hover:underline">
              School page
            </Link>
            , set a subject&apos;s next assessment with a date and it appears here.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {exams.map((s) => (
            <ExamCard key={s.id} subject={s} />
          ))}
        </div>
      )}

      {exams.length > 0 && undated.length > 0 && (
        <p className="mt-6 text-[12.5px] text-muted-2">
          No date set for {undated.map((s) => s.name).join(", ")}. Add one on the{" "}
          <Link href="/academics/school" className="underline underline-offset-2 hover:text-foreground">
            School page
          </Link>
          .
        </p>
      )}
    </div>
  );
}
