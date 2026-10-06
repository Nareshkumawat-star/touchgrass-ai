import {
  Award,
  ArrowRight,
  ArrowDown,
  Brain,
  Footprints,
  ScanEye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Brain, title: "AI", caption: "reads your time, level and mood" },
  { icon: ArrowRight, title: "Mission", caption: "one clear outdoor task" },
  { icon: Footprints, title: "Outside", caption: "phone stays in your pocket" },
  { icon: ScanEye, title: "Discovery", caption: "a photo you actually took" },
  { icon: Award, title: "Reward", caption: "points for time outdoors" },
];

/** The AI → Mission → Outside → Discovery → Reward flow, from the product spec. */
export function FlowDiagram({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <ol className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-1">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex flex-1 flex-col items-center gap-2 sm:flex-row">
            <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-soft sm:flex-col sm:px-3 sm:py-5 sm:text-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <step.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{step.title}</span>
                <span className="block text-xs text-muted-foreground sm:mt-1">
                  {step.caption}
                </span>
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <>
                <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground/60 sm:block" />
                <ArrowDown className="size-4 text-muted-foreground/60 sm:hidden" />
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
