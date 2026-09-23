"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Loader2, Pencil, Trash2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { apiJson, errorMessage } from "@/lib/client/api";
import type { ClothingItem } from "@/lib/types";

export function ItemActions({ item, outfitCount }: { item: ClothingItem; outfitCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [keepImage, setKeepImage] = useState(false);
  const [busy, setBusy] = useState<"delete" | "duplicate" | null>(null);

  async function duplicate() {
    setBusy("duplicate");
    try {
      const res = await apiJson<{ item: ClothingItem }>(`/api/items/${item.id}/duplicate`, "POST");
      toast("Duplicated");
      router.push(`/wardrobe/${res.item.id}/edit`);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await apiJson(`/api/items/${item.id}${keepImage ? "?keepImage=1" : ""}`, "DELETE");
      toast(`Deleted “${item.name}”`);
      router.replace("/");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
      setBusy(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        <ActionButton href={`/wardrobe/${item.id}/edit`} icon={<Pencil />} label="Edit" />
        <ActionButton href={`/outfits/picker?item=${item.id}`} icon={<WandSparkles />} label="Outfit" />
        <ActionButton onClick={duplicate} icon={busy === "duplicate" ? <Loader2 className="animate-spin" /> : <Copy />} label="Duplicate" />
        <ActionButton onClick={() => setConfirmDelete(true)} icon={<Trash2 />} label="Delete" destructive />
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{item.name}”?</DialogTitle>
            <DialogDescription>
              This removes the item and its metadata{outfitCount > 0 ? ` and takes it out of ${outfitCount} saved outfit${outfitCount === 1 ? "" : "s"}` : ""}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {item.imagePath && (
            <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
              <input type="checkbox" className="size-5 accent-current" checked={keepImage} onChange={(e) => setKeepImage(e.target.checked)} />
              Keep the photo file in data/images
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy === "delete"}>
              {busy === "delete" && <Loader2 className="animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionButton({
  href,
  onClick,
  icon,
  label,
  destructive,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
}) {
  const inner = (
    <>
      <span className="flex size-12 items-center justify-center rounded-full border bg-card [&_svg]:size-5">{icon}</span>
      <span className="text-xs">{label}</span>
    </>
  );
  const cls = `flex flex-col items-center gap-1.5 rounded-2xl py-1 active:bg-accent ${destructive ? "text-destructive" : ""}`;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
