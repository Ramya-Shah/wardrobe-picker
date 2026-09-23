"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shirt, Search, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Wardrobe", icon: Shirt, match: (p: string) => p === "/" || p.startsWith("/wardrobe") || p.startsWith("/import") },
  { href: "/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/search") },
  { href: "/outfits", label: "Outfits", icon: Sparkles, match: (p: string) => p.startsWith("/outfits") },
  { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") || p.startsWith("/export") },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-safe backdrop-blur-md supports-[backdrop-filter]:bg-background/80"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-[22px]", active && "stroke-[2.25]")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
