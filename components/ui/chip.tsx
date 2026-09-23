import * as React from "react";
import { cn } from "@/lib/utils";

/** Toggleable pill used for category tabs and filter options (44px touch target). */
function Chip({ className, active, ...props }: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

export { Chip };
