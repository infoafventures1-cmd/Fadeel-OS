"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CloudSun, MapPin } from "lucide-react";
import { OWNER } from "@/config";
import { TZ } from "@/lib/time";
import type { Weather } from "@/lib/server/home";

function greeting(d: Date) {
  const h = Number(d.toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }));
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function GreetingHeader({ weather, next }: { weather: Weather | null; next: { title: string; start: string } | null }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with the system clock, an external source of truth
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 className="text-[30px] font-semibold leading-none text-foreground sm:text-[38px]">
          {now ? greeting(now) : "Hello"}, <em>{OWNER.firstName}</em>.
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {now?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }) ?? "…"}
          {" · "}
          {now?.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) ?? "…"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {weather && (
          <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px]">
            <CloudSun size={15} className="text-amber" />
            <span className="text-foreground">{weather.temp}°C</span>
            <span className="text-muted-2">{weather.label}</span>
            <span className="flex items-center gap-1 text-muted-2">
              <MapPin size={10} /> {weather.city}
            </span>
          </div>
        )}
        {next && (
          <div className="glass rounded-xl px-3 py-2 text-[12.5px]">
            <span className="text-muted-2">Next: </span>
            <span className="text-foreground">{next.title}</span>
            <span className="text-muted-2"> · {next.start}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
