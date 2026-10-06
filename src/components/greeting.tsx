"use client";

import * as React from "react";
import { greeting } from "@/lib/utils";

/**
 * Renders "GOOD MORNING, NAME" using the *device's* local time, not the
 * server's. The server-rendered value is kept for the first paint so there is
 * no layout shift in the common case.
 */
export function Greeting({ name }: { name: string }) {
  const [text, setText] = React.useState(greeting());

  React.useEffect(() => {
    setText(greeting());
    const timer = setInterval(() => setText(greeting()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {text}, {name}
    </p>
  );
}
