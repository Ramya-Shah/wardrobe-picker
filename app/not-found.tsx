import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-serif text-2xl">Not found</h1>
      <p className="text-sm text-muted-foreground">This item or page doesn’t exist — it may have been deleted.</p>
      <Button asChild>
        <Link href="/">Back to wardrobe</Link>
      </Button>
    </main>
  );
}
