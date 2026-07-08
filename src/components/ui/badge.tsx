import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { PerformanceCategory } from "@/types";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        excellent:
          "border-transparent bg-emerald-100 text-emerald-700",
        good: "border-transparent bg-blue-100 text-blue-700",
        warning: "border-transparent bg-amber-100 text-amber-700",
        critical: "border-transparent bg-red-100 text-red-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export function PerformanceBadge({
  category,
  className,
}: {
  category: PerformanceCategory;
  className?: string;
}) {
  const labels: Record<PerformanceCategory, string> = {
    excellent: "Excellent",
    good: "Good",
    warning: "Warning",
    critical: "Critical",
  };
  return (
    <Badge variant={category} className={className}>
      {labels[category]}
    </Badge>
  );
}

export { Badge, badgeVariants };
