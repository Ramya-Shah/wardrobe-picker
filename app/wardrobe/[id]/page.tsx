import Link from "next/link";
import { notFound } from "next/navigation";
import { FileJson, Maximize2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ClothingImage } from "@/components/clothing/clothing-image";
import { DetailRows } from "@/components/clothing/detail-rows";
import { ItemActions } from "@/components/clothing/item-actions";
import { fieldOrigin, OriginMark, ProvenanceLegend } from "@/components/clothing/provenance";
import { OutfitCard } from "@/components/outfits/outfit-card";
import { Badge } from "@/components/ui/badge";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import { PAIRING_KEYS } from "@/lib/constants/vocab";
import { getItem } from "@/lib/db/clothing";
import { outfitsForItem } from "@/lib/db/outfits";
import { imageUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const item = await getItem((await params).id);
  return { title: item?.name ?? "Item" };
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();
  const outfits = await outfitsForItem(id);

  const hasPairing = PAIRING_KEYS.some((k) => item.pairingSuggestions[k].length > 0);

  return (
    <>
      <PageHeader title={item.name} backHref="/" />
      <PageBody className="space-y-6">
        <div className="relative -mx-4 bg-muted sm:mx-0 sm:overflow-hidden sm:rounded-2xl">
          <ClothingImage
            id={item.id}
            hash={item.imageHash}
            hasImage={Boolean(item.imagePath)}
            alt={item.name}
            size="full"
            priority
            fit="contain"
            className="max-h-[70dvh] w-full"
          />
          {item.imagePath && (
            <a
              href={imageUrl(item.id, item.imageHash, "full")}
              target="_blank"
              rel="noreferrer"
              aria-label="Open full-size photo"
              className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full bg-background/80 backdrop-blur"
            >
              <Maximize2 className="size-4" />
            </a>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{categoryLabel(item.category)}</Badge>
            {item.subcategory && <Badge variant="outline">{humanize(item.subcategory)}</Badge>}
            {item.aiGenerated ? <Badge variant="ai">Claude</Badge> : <Badge>Manual</Badge>}
            {item.userEdited && <Badge variant="success">Edited</Badge>}
          </div>
          <h2 className="font-serif text-[26px] leading-tight">{item.name}</h2>
          <ProvenanceLegend item={item} />
        </div>

        <ItemActions item={item} outfitCount={outfits.length} />

        {item.description && (
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
              Description <OriginMark origin={fieldOrigin(item, "description")} />
            </h3>
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/85">{item.description}</p>
          </section>
        )}

        {item.userNotes && (
          <section className="rounded-2xl bg-secondary px-4 py-3">
            <h3 className="mb-1 text-sm font-semibold">My notes</h3>
            <p className="whitespace-pre-line text-sm">{item.userNotes}</p>
          </section>
        )}

        <Section title="Details">
          <DetailRows
            item={item}
            rows={[
              { field: "category", label: "Category", value: categoryLabel(item.category) },
              { field: "subcategory", label: "Type", value: item.subcategory },
              { field: "primaryColor", label: "Color", value: item.primaryColor },
              { field: "secondaryColors", label: "Also", value: item.secondaryColors },
              { field: "pattern", label: "Pattern", value: item.pattern },
              { field: "texture", label: "Texture", value: item.texture },
              { field: "graphic", label: "Graphic", value: item.graphic },
              { field: "logo", label: "Logo", value: item.logo },
              { field: "material", label: "Material", value: item.material },
              { field: "fit", label: "Fit", value: item.fit },
              { field: "sleeveType", label: "Sleeves", value: item.sleeveType },
              { field: "neckline", label: "Neckline", value: item.neckline },
              { field: "length", label: "Length", value: item.length },
              { field: "silhouette", label: "Silhouette", value: item.silhouette },
            ]}
          />
        </Section>

        <Section title="Style & context">
          <DetailRows
            item={item}
            rows={[
              { field: "styles", label: "Style", value: item.styles },
              { field: "formality", label: "Formality", value: item.formality },
              { field: "seasons", label: "Seasons", value: item.seasons },
              { field: "occasions", label: "Occasions", value: item.occasions },
              { field: "environments", label: "Where", value: item.environments },
            ]}
          />
        </Section>

        {item.tags.length > 0 && (
          <Section title="Tags" origin={<OriginMark origin={fieldOrigin(item, "tags")} />}>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} className="rounded-full border px-3 py-1.5 text-sm active:bg-accent">
                  #{t}
                </Link>
              ))}
            </div>
          </Section>
        )}

        {hasPairing && (
          <Section title="Pairs well with" origin={<OriginMark origin={fieldOrigin(item, "pairingSuggestions")} />}>
            <div className="divide-y rounded-2xl border bg-card">
              {PAIRING_KEYS.filter((k) => item.pairingSuggestions[k].length).map((k) => (
                <div key={k} className="px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{humanize(k)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.pairingSuggestions[k].map((s) => (
                      <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="rounded-full bg-secondary px-3 py-1 text-sm active:bg-accent">
                        {s}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {outfits.length > 0 && (
          <Section title="In outfits">
            <div className="grid grid-cols-2 gap-3">
              {outfits.map((o) => (
                <OutfitCard key={o.id} outfit={o} />
              ))}
            </div>
          </Section>
        )}

        <section className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
          <p>ID: <span className="font-mono">{item.id}</span></p>
          {item.originalFilename && <p>Original file: {item.originalFilename}</p>}
          <p>Added {new Date(item.createdAt).toLocaleDateString()} · Updated {new Date(item.updatedAt).toLocaleDateString()}</p>
          {item.aiGenerated && (
            <a href={`/api/items/${item.id}/raw`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
              <FileJson className="size-3.5" /> Original Claude JSON
            </a>
          )}
        </section>
      </PageBody>
    </>
  );
}

function Section({ title, origin, children }: { title: string; origin?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {title} {origin}
      </h3>
      {children}
    </section>
  );
}
