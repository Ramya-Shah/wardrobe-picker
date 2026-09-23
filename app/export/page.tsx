import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ClaudeExport } from "@/components/settings/claude-export";
import { EmptyWardrobe } from "@/components/wardrobe/empty-wardrobe";
import { countByCategory } from "@/lib/db/clothing";
import { searchItems } from "@/lib/search/search";

export const dynamic = "force-dynamic";
export const metadata = { title: "Export for Claude" };

export default async function ExportPage() {
  const [categoryCounts, initial] = await Promise.all([countByCategory(), searchItems({ q: "", filters: {}, sort: "newest", offset: 0, limit: 48 })]);
  return (
    <>
      <PageHeader title="Export for Claude" backHref="/settings" />
      <PageBody className="pt-1">
        {initial.total === 0 ? <EmptyWardrobe /> : <ClaudeExport initial={initial} categoryCounts={categoryCounts} />}
      </PageBody>
    </>
  );
}
