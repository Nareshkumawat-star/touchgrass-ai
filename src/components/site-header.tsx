"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusStrip } from "./status-strip";

const NAV = [
  { href: "/dashboard", label: "Today" },
  { href: "/discoveries", label: "Discoveries" },
  { href: "/rewards", label: "Rewards" },
  { href: "/open", label: "Why Open AI?" },
];

export function SiteHeader({ showStatus = true }: { showStatus?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-full">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            TouchGrass<span className="text-accent"> AI</span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "focus-ring rounded-full px-3.5 py-2 text-sm transition-colors",
                pathname === item.href
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {showStatus && (
          <div className="ml-auto md:ml-2">
            <StatusStrip compact />
          </div>
        )}

        <button
          type="button"
          className="focus-ring ml-1 inline-flex size-10 items-center justify-center rounded-full border border-border bg-card md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav className="animate-fade-up border-t border-border bg-card px-4 py-3 md:hidden">
          <ul className="grid gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "block rounded-xl px-4 py-3 text-base",
                    pathname === item.href
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-surface",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
