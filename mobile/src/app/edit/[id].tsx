import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { EDITABLE_FIELDS } from "@/lib/constants/fields";
import type { ClothingItemInput } from "@/lib/types";
import { parseClothingPatch } from "@/lib/validation/clothing";
import { formatZodIssues } from "@/lib/validation/primitives";
import { ClothingForm } from "~/components/clothing-form";
import { ClothingImage } from "~/components/clothing-image";
import { replaceItemImage } from "~/core/item-actions";
import { updateItemMetadata } from "~/core/items";
import { pickPhotos, takePhoto, type PickedFile } from "~/platform/pickers";
import { useWardrobe } from "~/state/wardrobe";
import { Body, Button, Muted } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { useToast } from "~/ui/toast";
import { radius, useColors } from "~/ui/theme";

/** Only changed fields are saved, so exactly those get marked "edited by you". */
export default function EditScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { svc, itemsById, refresh } = useWardrobe();
  const toast = useToast();
  const item = itemsById.get(id);
  const original = useMemo(() => (item ? (Object.fromEntries(EDITABLE_FIELDS.map((k) => [k, item[k]])) as unknown as ClothingItemInput) : null), [item]);
  const [value, setValue] = useState<ClothingItemInput | null>(original);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  if (!item || !value || !original) {
    return (
      <Screen title="Not found" back>
        <Body style={{ padding: 16 }}>This item doesn’t exist.</Body>
      </Screen>
    );
  }
  const changed = EDITABLE_FIELDS.filter((k) => JSON.stringify(value[k]) !== JSON.stringify(original[k]));

  const save = async () => {
    if (!value.name.trim()) return setNameError("Name is required");
    if (!changed.length) return router.back();
    const patch = parseClothingPatch(Object.fromEntries(changed.map((k) => [k, value[k]])));
    if (!patch.success) return toast(formatZodIssues(patch.error).join("\n"), "error");
    setSaving(true);
    try {
      await updateItemMetadata(svc.db, item.id, patch.data);
      await refresh();
      toast("Saved");
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
      setSaving(false);
    }
  };

  const replacePhoto = async (get: () => Promise<PickedFile | null>) => {
    try {
      const picked = await get();
      if (!picked) return;
      setPhotoBusy(true);
      const { duplicateOf } = await replaceItemImage(svc, item.id, picked);
      await refresh();
      toast(duplicateOf ? `Photo replaced — the same photo is also used by “${duplicateOf.name}”.` : "Photo replaced", duplicateOf ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <Screen title="Edit" subtitle={item.name} back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 24 }}>
            <ClothingImage imagePath={item.imagePath} style={{ width: 90, aspectRatio: 3 / 4, borderRadius: radius.md }} />
            <View style={{ gap: 8, flex: 1 }}>
              <Button title="Replace from gallery" icon="images-outline" size="sm" variant="outline" loading={photoBusy} onPress={() => replacePhoto(async () => (await pickPhotos(false))[0] ?? null)} />
              <Button title="Take a new photo" icon="camera-outline" size="sm" variant="outline" disabled={photoBusy} onPress={() => replacePhoto(takePhoto)} />
            </View>
          </View>
          <ClothingForm value={value} onChange={(v) => { setValue(v); setNameError(null); }} item={{ ...item, editedFields: [...new Set([...item.editedFields, ...changed])] }} nameError={nameError} />
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
          <Muted style={{ flex: 1 }}>{changed.length ? `${changed.length} change${changed.length === 1 ? "" : "s"} — kept even if you re-import` : "No changes"}</Muted>
          <Button title="Save" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
