import { AssistantChat } from "@/components/ai/assistant-chat";
import { GlassCard } from "@/components/ui/glass-card";

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-[860px]">
      <GlassCard hover={false} className="h-[calc(100vh-150px)] min-h-[520px] overflow-hidden">
        <AssistantChat />
      </GlassCard>
    </div>
  );
}
