import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { listItems } from "~/core/items";
import { listOutfits } from "~/core/outfits";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from "~/core/settings";
import type { Services } from "~/core/services";
import { createExpoServices } from "~/platform/expo-services";
import type { ClothingItem, Outfit } from "@/lib/types";

interface WardrobeState {
  svc: Services;
  items: ClothingItem[];
  outfits: Outfit[];
  itemsById: Map<string, ClothingItem>;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  /** Reload items and outfits from the database after a change. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<WardrobeState | null>(null);

/**
 * Loads the whole wardrobe metadata into memory once (hundreds of items are only a few
 * hundred KB) so browsing and search are instant; photos stay on disk and load lazily.
 */
export function WardrobeProvider({ children, fallback }: { children: React.ReactNode; fallback: (error: string | null) => React.ReactNode }) {
  const [svc, setSvc] = useState<Services | null>(null);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const load = useCallback(async (s: Services) => {
    const all = await listItems(s.db);
    setItems(all);
    setOutfits(await listOutfits(s.db, all));
  }, []);

  useEffect(() => {
    let cancelled = false;
    createExpoServices()
      .then(async (s) => {
        await load(s);
        setSettings(await loadSettings(s.db));
        if (!cancelled) setSvc(s);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    if (svc) await load(svc);
  }, [svc, load]);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      if (svc) await saveSettings(svc.db, patch);
    },
    [svc],
  );

  const value = useMemo(
    () => (svc ? { svc, items, outfits, itemsById: new Map(items.map((i) => [i.id, i])), refresh, settings, updateSettings } : null),
    [svc, items, outfits, refresh, settings, updateSettings],
  );

  if (!value) return <>{fallback(error)}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWardrobe(): WardrobeState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWardrobe must be used inside WardrobeProvider");
  return v;
}
