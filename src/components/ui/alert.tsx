import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, Leaf } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const calloutVariants = cva(
  "flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed",
  {
    variants: {
      variant: {
        info: "border-sky/35 bg-sky/10 text-foreground",
        warning: "border-sun/45 bg-sun/12 text-foreground",
        success: "border-accent/35 bg-accent/10 text-foreground",
        nature: "border-primary/25 bg-secondary text-secondary-foreground",
        danger: "border-destructive/40 bg-destructive/10 text-foreground",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  nature: Leaf,
  danger: AlertTriangle,
} as const;

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  title?: string;
  icon?: React.ReactNode;
  hideIcon?: boolean;
}

export function Callout({
  className,
  variant = "info",
  title,
  icon,
  hideIcon,
  children,
  ...props
}: CalloutProps) {
  const Icon = ICONS[variant ?? "info"];
  return (
    <div className={cn(calloutVariants({ variant }), className)} {...props}>
      {!hideIcon && (
        <span className="mt-0.5 shrink-0" aria-hidden>
          {icon ?? <Icon className="size-4" />}
        </span>
      )}
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        <div className="text-muted-foreground [&_strong]:text-foreground">{children}</div>
      </div>
    </div>
  );
}
