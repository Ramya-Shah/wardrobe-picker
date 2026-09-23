import Link from "next/link";
import { Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { WardrobeBrowser } from "@/components/wardrobe/wardrobe-browser";
import { EmptyWardrobe } from "@/components/wardrobe/empty-wardrobe";
import { QuickActions } from "@/components/wardrobe/quick-actions";
import { RecentStrip } from "@/components/wardrobe/recent-strip";
import { countByCategory, recentItems } from "@/lib/db/clothing";
import { countOutfits } from "@/lib/db/outfits";
import { toSummary } from "@/lib/db/mappers";
import { searchItems } from "@/lib/search/search";
import { pluralize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categoryCounts, recent, outfitCount, initial] = await Promise.all([
    countByCategory(),
    recentItems(10),
    countOutfits(),
    searchItems({ q: "", filters: {}, sort: "newest", offset: 0, limit: 48 }),
  ]);
  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        large
        title="My Wardrobe"
        subtitle={total > 0 ? `${pluralize(total, "item")} · ${pluralize(outfitCount, "outfit")}` : undefined}
        actions={
          <Button asChild size="icon" variant="outline" aria-label="Add clothing">
            <Link href="/wardrobe/new">
              <Plus />
            </Link>
          </Button>
        }
      />
      <PageBody>
        {total === 0 ? (
          <EmptyWardrobe />
        ) : (
          <div className="space-y-6 pt-2">
            <QuickActions />
            {recent.length > 3 && (
              <section>
                <h2 className="mb-2.5 text-sm font-semibold">Recently added</h2>
                <RecentStrip items={recent.map(toSummary)} />
              </section>
            )}
            <section>
              <h2 className="mb-1 text-sm font-semibold">All clothes</h2>
              <WardrobeBrowser
                initial={initial}
                initialState={{ q: "", filters: {}, sort: "newest" }}
                categoryCounts={categoryCounts}
                syncUrl={false}
              />
            </section>
          </div>
        )}
      </PageBody>
    </>
  );
}
