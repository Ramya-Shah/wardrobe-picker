"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { apiJson, errorMessage } from "@/lib/client/api";

export function DangerZone() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="outline" className="w-full border-destructive/40 text-destructive" onClick={() => setOpen(true)}>
        <Trash2 /> Delete all wardrobe data
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); setConfirm(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete everything?</DialogTitle>
            <DialogDescription>
              All clothing items, photos and outfits will be permanently deleted from this computer. Download a full backup first if you might want them back.
            </DialogDescription>
          </DialogHeader>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type DELETE to confirm" autoCapitalize="characters" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== "DELETE" || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await apiJson("/api/admin/wipe", "POST", { confirm });
                  toast("Wardrobe deleted");
                  setOpen(false);
                  router.push("/");
                  router.refresh();
                } catch (e) {
                  toast(errorMessage(e), "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && <Loader2 className="animate-spin" />} Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
