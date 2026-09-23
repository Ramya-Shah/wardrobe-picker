import Link from "next/link";
import { FileJson, WandSparkles } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { OutfitCard } from "@/components/outfits/outfit-card";
import { Button } from "@/components/ui/button";
import { listOutfits } from "@/lib/db/outfits";
import { countItems } from "@/lib/db/clothing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outfits" };

export default async function OutfitsPage() {
  const [outfits, itemCount] = await Promise.all([listOutfits(), countItems()]);
  return (
    <>
      <PageHeader large title="Outfits" subtitle={outfits.length ? `${outfits.length} saved` : undefined} />
      <PageBody className="space-y-6 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <Button asChild size="lg">
            <Link href="/outfits/picker">
              <WandSparkles /> Outfit picker
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/outfits/import">
              <FileJson /> Import outfit
            </Link>
          </Button>
        </div>

        {outfits.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
            <p className="font-serif text-xl">No outfits yet</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              {itemCount === 0
                ? "Add some clothes first, then build outfits around them."
                : "Use the Outfit picker to gather candidates, ask Claude to put an outfit together, then import its answer."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
            {outfits.map((o) => (
              <OutfitCard key={o.id} outfit={o} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
