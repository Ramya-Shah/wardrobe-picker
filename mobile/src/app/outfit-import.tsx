import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { humanize } from "@/lib/constants/categories";
import { parseOutfitImport, validateOutfitReferences } from "@/lib/outfits/parse-outfit";
import { OutfitPieces } from "~/components/outfit-card";
import { createOutfit } from "~/core/outfits";
import { useWardrobe } from "~/state/wardrobe";
import { Banner, Body, Button, Card, Field, Muted, Title } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { useToast } from "~/ui/toast";
import { useColors } from "~/ui/theme";

/** Paste Claude's outfit JSON → check structure, roles and every clothing ID → preview with photos → save. */
export default function OutfitImportScreen() {
  const colors = useColors();
  const { svc, itemsById, refresh } = useWardrobe();
  const toast = useToast();
  const [json, setJson] = useState("");
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => {
    if (!json.trim()) return null;
    const parsed = parseOutfitImport(json);
    for (const o of parsed.outfits) {
      if (!o.outfit) continue;
      const { errors, warnings } = validateOutfitReferences(o.outfit, itemsById);
      o.errors.push(...errors);
      o.warnings.push(...warnings);
      o.ok = o.errors.length === 0;
    }
    return parsed;
  }, [json, itemsById]);
  const valid = result?.outfits.filter((o) => o.ok && o.outfit) ?? [];

  const save = async () => {
    setSaving(true);
    try {
      let last = "";
      for (const o of valid) last = await createOutfit(svc, o.outfit!, { source: "claude", raw: o.raw });
      await refresh();
      toast(`Saved ${valid.length} outfit${valid.length === 1 ? "" : "s"}`);
      router.replace(valid.length === 1 ? `/outfit/${last}` : "/outfits");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
      setSaving(false);
    }
  };

  return (
    <Screen title="Import outfit" back>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Muted>Paste the outfit JSON Claude returned. Every clothing ID is checked against your wardrobe — outfits with unknown items are rejected.</Muted>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Paste from clipboard" icon="clipboard-outline" style={{ flex: 1 }} onPress={async () => setJson(await Clipboard.getStringAsync())} />
          {json ? <Button title="Clear" variant="outline" onPress={() => setJson("")} /> : null}
        </View>
        <Field multiline value={json} onChangeText={setJson} placeholder='{"name": "Casual Dinner", "items": [{"clothingItemId": "itm_…", "role": "TOP"}, …]}' autoCapitalize="none" autoCorrect={false} style={{ minHeight: 120, fontFamily: "monospace", fontSize: 12 }} />
        {result?.fatal ? <Banner tone="error">{result.fatal}</Banner> : null}
        {result?.outfits.map((o) => (
          <Card key={o.index} style={{ padding: 14, gap: 12 }}>
            <View>
              <Title style={{ fontSize: 20 }}>{o.outfit?.name ?? o.label}</Title>
              {o.outfit ? <Muted>{[o.outfit.occasion, o.outfit.season, o.outfit.style].filter(Boolean).map((v) => humanize(v)).join(" · ")}</Muted> : null}
            </View>
            {o.errors.length > 0 && (
              <Banner tone="error">
                <View style={{ gap: 2 }}>
                  <Text style={{ color: colors.destructive, fontWeight: "500" }}>This outfit can’t be imported:</Text>
                  {o.errors.map((e) => (
                    <Text key={e} style={{ color: colors.destructive, fontSize: 12 }}>• {e}</Text>
                  ))}
                </View>
              </Banner>
            )}
            {o.warnings.map((w) => (
              <Muted key={w} style={{ fontSize: 12 }}>⚠︎ {w}</Muted>
            ))}
            {o.outfit && <OutfitPieces pieces={o.outfit.items.map((i) => ({ role: i.role, clothingItemId: i.clothingItemId, item: null }))} />}
            {o.outfit?.explanation ? <Body style={{ color: colors.mutedForeground }}>{o.outfit.explanation}</Body> : null}
          </Card>
        ))}
        {result && !result.fatal && (
          <Button title={valid.length ? `Save ${valid.length === 1 ? "outfit" : `${valid.length} outfits`}` : "Nothing valid to save"} size="lg" disabled={!valid.length} loading={saving} onPress={save} />
        )}
      </ScrollView>
    </Screen>
  );
}
