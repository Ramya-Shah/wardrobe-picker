import { PageBody, PageHeader } from "@/components/layout/page-header";
import { OutfitImporter } from "@/components/outfits/outfit-import";

export const metadata = { title: "Import outfit" };

export default function ImportOutfitPage() {
  return (
    <>
      <PageHeader title="Import outfit" backHref="/outfits" />
      <PageBody className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Paste the outfit JSON Claude returned. Every clothing ID is checked against your wardrobe — outfits that reference unknown items are rejected.
        </p>
        <OutfitImporter />
      </PageBody>
    </>
  );
}
