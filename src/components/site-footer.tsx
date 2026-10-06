import Link from "next/link";
import { Leaf } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-surface/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Leaf className="size-4" />
            </span>
            <span className="font-display text-base font-semibold">TouchGrass AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            AI that gives you a reason to put your phone down. Missions are designed to be
            finished away from the screen.
          </p>
        </div>

        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              App
            </p>
            <Link href="/dashboard" className="block text-muted-foreground hover:text-foreground">
              Today
            </Link>
            <Link href="/discoveries" className="block text-muted-foreground hover:text-foreground">
              Discoveries
            </Link>
            <Link href="/rewards" className="block text-muted-foreground hover:text-foreground">
              Rewards
            </Link>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Project
            </p>
            <Link href="/open" className="block text-muted-foreground hover:text-foreground">
              Why Open AI?
            </Link>
            <Link href="/privacy" className="block text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/api/health" className="block text-muted-foreground hover:text-foreground">
              System status
            </Link>
          </div>
        </nav>
      </div>

      <div className="border-t border-border/70 px-4 py-5 sm:px-6">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          Built with Next.js, MongoDB/Mongoose, Ollama + open-weight Qwen models, and
          OpenStreetMap. Identifications are AI estimates — never certain — and are not
          medical or safety advice. Stay aware of your surroundings and follow local rules.
        </p>
      </div>
    </footer>
  );
}
