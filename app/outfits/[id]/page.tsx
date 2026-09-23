import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { DeleteOutfit } from "@/components/outfits/delete-outfit";
import { OutfitPieces } from "@/components/outfits/outfit-pieces";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/constants/categories";
import { getOutfit } from "@/lib/db/outfits";

export const dynamic = "force-dynamic";

export default async function OutfitPage({ params }: { params: Promise<{ id: string }> }) {
  const outfit = await getOutfit((await params).id);
  if (!outfit) notFound();
  return (
    <>
      <PageHeader title={outfit.name} backHref="/outfits" actions={<DeleteOutfit id={outfit.id} name={outfit.name} />} />
      <PageBody className="space-y-5 pt-2">
        <div className="flex flex-wrap gap-1.5">
          {outfit.occasion && <Badge variant="outline">{humanize(outfit.occasion)}</Badge>}
          {outfit.season && <Badge variant="outline">{humanize(outfit.season)}</Badge>}
          {outfit.style && <Badge variant="outline">{humanize(outfit.style)}</Badge>}
          {outfit.source === "claude" && <Badge variant="ai">Claude</Badge>}
        </div>
        <OutfitPieces pieces={outfit.items} />
        {outfit.description && <p className="text-[15px] leading-relaxed">{outfit.description}</p>}
        {outfit.explanation && (
          <section className="rounded-2xl bg-secondary px-4 py-3">
            <h2 className="mb-1 text-sm font-semibold">Why it works</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">{outfit.explanation}</p>
          </section>
        )}
        <p className="text-xs text-muted-foreground">Saved {new Date(outfit.createdAt).toLocaleDateString()}</p>
      </PageBody>
    </>
  );
}
