import { PageBody, PageHeader } from "@/components/layout/page-header";
import { WardrobeBrowser } from "@/components/wardrobe/wardrobe-browser";
import { EmptyWardrobe } from "@/components/wardrobe/empty-wardrobe";
import { countByCategory } from "@/lib/db/clothing";
import { searchQueryFromParams } from "@/lib/search/filters";
import { searchItems } from "@/lib/search/search";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wardrobe" };

export default async function WardrobePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchQueryFromParams(await searchParams, { sort: "newest", limit: 48 });
  const [categoryCounts, initial] = await Promise.all([countByCategory(), searchItems({ ...query, offset: 0 })]);
  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader title="Wardrobe" backHref="/" />
      <PageBody>
        {total === 0 ? (
          <EmptyWardrobe />
        ) : (
          <WardrobeBrowser
            initial={initial}
            initialState={{ q: query.q, filters: query.filters, sort: query.sort }}
            categoryCounts={categoryCounts}
            stickyTop="top-14"
          />
        )}
      </PageBody>
    </>
  );
}
