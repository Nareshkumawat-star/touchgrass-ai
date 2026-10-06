import { Clock, ListChecks, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";

/**
 * A static example of the mission contract, shown on the landing page so the
 * product is legible before any AI call happens.
 */
export function MissionPreview({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="nature">
            <Sparkles className="size-3" /> 30-Minute Nature Detective
          </Badge>
          <Badge variant="outline">
            <Clock className="size-3" /> {formatDuration(30)}
          </Badge>
          <Badge variant="outline">Easy</Badge>
        </div>
        <CardTitle className="font-display text-2xl">
          Take a relaxed walk outside and discover things you normally ignore.
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium">
            <ListChecks className="size-4 text-accent" /> Steps
          </p>
          <ol className="space-y-1.5 text-muted-foreground">
            <li>1. Walk for 10 minutes with your phone in your pocket.</li>
            <li>2. Find two leaves with clearly different shapes.</li>
            <li>3. Find one bird or insect and watch it for a minute.</li>
            <li>4. Stop for 2 minutes and listen to your surroundings.</li>
          </ol>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium">
            <Target className="size-4 text-accent" /> Things to look for
          </p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>• Two different leaf shapes</li>
            <li>• Something moving in a hedge</li>
            <li>• A sound you cannot name yet</li>
          </ul>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-surface p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            Stay aware of your surroundings and follow local rules. Missions never involve
            traffic, climbing, water or approaching animals.
          </span>
        </div>
        <p className="text-xs font-medium text-primary">Reward: 100 Grass Points</p>
      </CardContent>
    </Card>
  );
}
