import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import type { ClothingItemInput } from "@/lib/types";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { ClothingForm, emptyClothingInput } from "~/components/clothing-form";
import { commitImport } from "~/core/commit";
import { createStagingDir, removeStagingDir, stageImage, type StagedImage } from "~/core/images";
import { findItemsByHashes } from "~/core/items";
import { pickPhotos, takePhoto, type PickedFile } from "~/platform/pickers";
import { useWardrobe } from "~/state/wardrobe";
import { Banner, Button } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { useToast } from "~/ui/toast";
import { colors, radius } from "~/ui/theme";

/** Add an item by hand: photo + form. Same duplicate-checked pipeline as imports. */
export default function AddScreen() {
  const { svc, refresh } = useWardrobe();
  const toast = useToast();
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [value, setValue] = useState<ClothingItemInput>(emptyClothingInput());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choose = async (fn: () => Promise<PickedFile | null>) => {
    try {
      const p = await fn();
      if (p) setPhoto(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const commit = async (dir: string, staged: StagedImage, duplicateAction: "add" | null) => {
    const res = await commitImport(svc, [{ staged, input: value, inferredFields: [], editedFields: [], source: "manual", duplicateAction }]);
    await removeStagingDir(svc, dir);
    if (!res.ok) throw new Error(res.errors.map((e) => e.message).join("\n"));
    await refresh();
    toast("Added to your wardrobe");
    router.replace(`/item/${res.created[0].id}`);
  };

  const save = async () => {
    setError(null);
    if (!photo) return setError("Add a photo of the item.");
    const check = clothingItemInputSchema.safeParse(value);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "Please check the form.");
    setSaving(true);
    const dir = await createStagingDir(svc);
    try {
      const staged = await stageImage(svc, dir, photo);
      const dup = (await findItemsByHashes(svc.db, [staged.hash])).get(staged.hash);
      if (dup) {
        setSaving(false);
        Alert.alert("This clothing image already exists.", `The same photo is already in your wardrobe as “${dup.name}”.`, [
          { text: "Skip — view existing", onPress: () => { void removeStagingDir(svc, dir); router.replace(`/item/${dup.id}`); } },
          { text: "Add anyway", onPress: () => commit(dir, staged, "add").catch((e: unknown) => setError(e instanceof Error ? e.message : String(e))) },
        ]);
        return;
      }
      await commit(dir, staged, null);
    } catch (e) {
      await removeStagingDir(svc, dir);
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <Screen title="Add clothing" back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Pressable onPress={() => choose(async () => (await pickPhotos(false))[0] ?? null)} style={{ width: 140, aspectRatio: 3 / 4, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.input, backgroundColor: colors.card, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={28} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 6 }}>Choose photo</Text>
                </>
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 8, justifyContent: "center" }}>
              <Button title="Take photo" icon="camera-outline" size="sm" variant="outline" onPress={() => choose(takePhoto)} />
              <Button title="From gallery" icon="images-outline" size="sm" variant="outline" onPress={() => choose(async () => (await pickPhotos(false))[0] ?? null)} />
              <Button title="Use Claude instead" icon="sparkles-outline" size="sm" variant="ghost" onPress={() => router.replace("/import?mode=single")} />
            </View>
          </View>
          <ClothingForm value={value} onChange={setValue} />
          {error ? <Banner tone="error">{error}</Banner> : null}
        </ScrollView>
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
          <Button title="Add to wardrobe" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
