import { PageBody, PageHeader } from "@/components/layout/page-header";
import { OutfitPicker, type PickerCandidateView } from "@/components/outfits/outfit-picker";
import { OUTFIT_ROLES, type OutfitRole } from "@/lib/constants/vocab";
import { listAllItems } from "@/lib/db/clothing";
import { toSummary } from "@/lib/db/mappers";
import { pickOutfitCandidates } from "@/lib/outfits/picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outfit picker" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 100) ?? "";

export default async function PickerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const criteria = {
    occasion: one(sp.occasion),
    style: one(sp.style),
    season: one(sp.season),
    requiredIds: one(sp.item).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20),
  };
  const items = await listAllItems();
  const result = pickOutfitCandidates(items, criteria);
  const groups = Object.fromEntries(
    OUTFIT_ROLES.map((r) => [r, result.groups[r].map((c) => ({ item: toSummary(c.item), score: c.score, reasons: c.reasons }))]),
  ) as Record<OutfitRole, PickerCandidateView[]>;

  return (
    <>
      <PageHeader title="Outfit picker" backHref="/outfits" />
      <PageBody className="pt-2">
        <OutfitPicker key={JSON.stringify(criteria)} criteria={criteria} anchors={result.anchors.map(toSummary)} groups={groups} />
      </PageBody>
    </>
  );
}
