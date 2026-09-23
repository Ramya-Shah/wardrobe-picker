import Link from "next/link";
import { Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyWardrobe() {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon.svg" alt="" className="size-12 opacity-80" />
      </div>
      <h2 className="font-serif text-2xl">No clothes yet.</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Add your first clothing photo or import metadata from Claude.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        <Button asChild size="lg">
          <Link href="/import">
            <Sparkles /> Import from Claude
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/wardrobe/new">
            <Camera /> Add clothing
          </Link>
        </Button>
      </div>
    </div>
  );
}
