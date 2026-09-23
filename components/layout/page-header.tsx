import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sticky top bar with optional back link and right-side actions. */
export function PageHeader({
  title,
  subtitle,
  backHref,
  actions,
  className,
  large = false,
}: {
  title: string;
  subtitle?: React.ReactNode;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
  large?: boolean;
}) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-transparent bg-background/92 pt-safe backdrop-blur-md", className)}>
      <div className="flex min-h-14 items-center gap-2 px-4 py-2">
        {backHref && (
          <Link href={backHref} aria-label="Back" className="-ml-2 flex size-10 items-center justify-center rounded-full hover:bg-accent">
            <ChevronLeft className="size-6" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={cn("truncate font-serif tracking-tight", large ? "text-[28px] leading-9" : "text-xl")}>{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </header>
  );
}

export function PageBody({ className, ...props }: React.ComponentProps<"main">) {
  return <main className={cn("mx-auto w-full max-w-2xl flex-1 px-4 pb-28", className)} {...props} />;
}
