import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl border border-nexus-border bg-white/95 shadow-[0_10px_40px_-25px_rgba(7,20,47,0.35)]", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export { Card };
