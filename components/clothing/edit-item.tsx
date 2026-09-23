"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { apiForm, apiJson, errorMessage } from "@/lib/client/api";
import { EDITABLE_FIELDS } from "@/lib/constants/fields";
import type { ClothingItem, ClothingItemInput, EditableField } from "@/lib/types";
import { ClothingForm } from "./clothing-form";
import { ClothingImage } from "./clothing-image";

function pickInput(item: ClothingItem): ClothingItemInput {
  return Object.fromEntries(EDITABLE_FIELDS.map((k) => [k, item[k]])) as unknown as ClothingItemInput;
}

/** Edit page body: only fields that actually changed are sent, so they get marked "edited by you". */
export function EditItem({ item: initialItem }: { item: ClothingItem }) {
  const router = useRouter();
  const toast = useToast();
  const [item, setItem] = useState(initialItem);
  const original = useMemo(() => pickInput(item), [item]);
  const [value, setValue] = useState<ClothingItemInput>(original);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<EditableField, string>>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const changed = EDITABLE_FIELDS.filter((k) => JSON.stringify(value[k]) !== JSON.stringify(original[k]));

  async function save() {
    if (!value.name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }
    if (changed.length === 0) {
      router.push(`/wardrobe/${item.id}`);
      return;
    }
    setSaving(true);
    try {
      const fields = Object.fromEntries(changed.map((k) => [k, value[k]]));
      await apiJson(`/api/items/${item.id}`, "PATCH", { fields });
      toast("Saved");
      router.push(`/wardrobe/${item.id}`);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
      setSaving(false);
    }
  }

  async function replacePhoto(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await apiForm<{ item: ClothingItem; duplicateOf: { id: string; name: string } | null }>(`/api/items/${item.id}/image`, form);
      setItem(res.item);
      toast(res.duplicateOf ? `Photo replaced — note: the same photo is also used by “${res.duplicateOf.name}”.` : "Photo replaced", res.duplicateOf ? "info" : "success");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center gap-4">
        <div className="aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl">
          <ClothingImage id={item.id} hash={item.imageHash} hasImage={Boolean(item.imagePath)} alt={item.name} className="size-full" />
        </div>
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && replacePhoto(e.target.files[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />} Replace photo
          </Button>
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 25 MB</p>
        </div>
      </div>

      <ClothingForm value={value} onChange={setValue} item={{ ...item, editedFields: [...new Set([...item.editedFields, ...changed])] }} errors={errors} />

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">
            {changed.length ? `${changed.length} change${changed.length === 1 ? "" : "s"} — protected from future imports` : "No changes"}
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Save
          </Button>
        </div>
      </div>
    </div>
  );
}
