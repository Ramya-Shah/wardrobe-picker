import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ImportWizard } from "@/components/import/import-wizard";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Import from Claude" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return (
    <>
      <PageHeader
        title="Import from Claude"
        backHref="/"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/import/prompt">
              <MessageSquareText /> Prompt
            </Link>
          </Button>
        }
      />
      <PageBody className="pt-2">
        <ImportWizard initialMode={mode === "single" ? "single" : "batch"} />
      </PageBody>
    </>
  );
}
