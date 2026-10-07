import { GreetingHeader } from "@/components/home/greeting-header";
import { DayBrief } from "@/components/home/day-brief";
import { AttentionCenter } from "@/components/home/attention-center";
import { Workload } from "@/components/home/workload";
import { TodayPreview } from "@/components/home/today-preview";
import { ProjectHealthStrip } from "@/components/home/project-health-strip";
import { QuickLinksGrid } from "@/components/home/quick-links-grid";
import { getHomeData, getWeather } from "@/lib/server/home";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [home, weather] = await Promise.all([getHomeData(), getWeather()]);
  return (
    <div className="mx-auto max-w-[1280px]">
      <GreetingHeader weather={weather} next={home.next} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <DayBrief lines={home.brief} />
          <AttentionCenter items={home.attention} />
          <ProjectHealthStrip projects={home.byProject} />
          <QuickLinksGrid />
        </div>
        <div className="min-w-0 space-y-6">
          <Workload stats={home.stats} />
          <TodayPreview blocks={home.timeline.blocks} planned={home.timeline.planned} hasTimetable={home.timeline.hasTimetable} />
        </div>
      </div>
    </div>
  );
}
