import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-md border border-nexus-border bg-white px-3 py-2 text-sm text-nexus-text shadow-sm transition-colors placeholder:text-nexus-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-accent",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
