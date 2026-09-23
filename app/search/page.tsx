import { PageBody, PageHeader } from "@/components/layout/page-header";
import { WardrobeBrowser } from "@/components/wardrobe/wardrobe-browser";
import { EmptyWardrobe } from "@/components/wardrobe/empty-wardrobe";
import { countByCategory } from "@/lib/db/clothing";
import { searchQueryFromParams } from "@/lib/search/filters";
import { getFacets, searchItems } from "@/lib/search/search";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const EXAMPLES = ["black shirt", "oversized", "summer", "college", "white sneakers", "striped"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = searchQueryFromParams(await searchParams, { limit: 48 });
  const [categoryCounts, facets, initial] = await Promise.all([countByCategory(), getFacets(), searchItems({ ...query, offset: 0 })]);
  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader title="Search" />
      <PageBody>
        {total === 0 ? (
          <EmptyWardrobe />
        ) : (
          <>
            <WardrobeBrowser
              initial={initial}
              initialState={{ q: query.q, filters: query.filters, sort: query.sort }}
              categoryCounts={categoryCounts}
              facets={facets}
              showFilters
              autoFocus={!query.q}
              stickyTop="top-14"
            />
            {!query.q && (
              <p className="mt-8 text-center text-xs text-muted-foreground">
                Try: {EXAMPLES.map((e) => `“${e}”`).join(" · ")}
              </p>
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
