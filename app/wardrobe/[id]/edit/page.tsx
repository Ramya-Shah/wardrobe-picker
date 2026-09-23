import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { EditItem } from "@/components/clothing/edit-item";
import { getItem } from "@/lib/db/clothing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit item" };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();
  return (
    <>
      <PageHeader title="Edit" subtitle={item.name} backHref={`/wardrobe/${id}`} />
      <PageBody className="pt-2">
        <EditItem item={item} />
      </PageBody>
    </>
  );
}
