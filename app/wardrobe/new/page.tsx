import { PageBody, PageHeader } from "@/components/layout/page-header";
import { AddClothing } from "@/components/clothing/add-clothing";

export const metadata = { title: "Add clothing" };

export default function NewItemPage() {
  return (
    <>
      <PageHeader title="Add clothing" backHref="/" />
      <PageBody className="pt-2">
        <AddClothing />
      </PageBody>
    </>
  );
}
