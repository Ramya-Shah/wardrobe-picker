import Link from "next/link";
import { Camera, Search, Sparkles, WandSparkles } from "lucide-react";

const ACTIONS = [
  { href: "/wardrobe/new", label: "Add clothing", icon: Camera },
  { href: "/import", label: "Import from Claude", icon: Sparkles },
  { href: "/outfits/picker", label: "Outfit picker", icon: WandSparkles },
  { href: "/search", label: "Search", icon: Search },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ACTIONS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-2xl py-2 text-center active:bg-accent">
          <span className="flex size-12 items-center justify-center rounded-full border bg-card">
            <Icon className="size-5" />
          </span>
          <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
        </Link>
      ))}
    </div>
  );
}
