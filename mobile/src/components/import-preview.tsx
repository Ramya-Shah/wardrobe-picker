import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import type { ClothingItemInput } from "@/lib/types";
import type { DuplicateAction } from "~/core/commit";
import { Badge, Banner, Button, Card, Chip, Muted, Segmented } from "~/ui/primitives";
import { Sheet } from "~/ui/sheet";
import { radius, type Palette, useColors, useStyles } from "~/ui/theme";
import { ClothingForm, emptyClothingInput } from "./clothing-form";
import { blockingErrors, isDuplicate, isImportable, willSend, type PreviewItem } from "./import-model";

const ACTION_LABEL: Record<DuplicateAction, string> = { skip: "Skip", replace: "Replace metadata", add: "Add anyway" };

/** Everything that will be imported, with errors, duplicate decisions and editing — nothing is saved yet. */
export function ImportPreview({
  items,
  spares,
  onChange,
  onAssign,
}: {
  items: PreviewItem[];
  spares: string[];
  onChange: (key: string, patch: Partial<PreviewItem>) => void;
  onAssign: (key: string, photoName: string) => void;
}) {
  const colors = useColors();
  const [editing, setEditing] = useState<PreviewItem | null>(null);
  const [draft, setDraft] = useState<ClothingItemInput | null>(null);
  const [assigning, setAssigning] = useState<PreviewItem | null>(null);

  const failing = items.filter((i) => !i.excluded && blockingErrors(i).length > 0);
  const ready = items.filter(isImportable);
  const dups = ready.filter(isDuplicate);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Stat label="Ready" value={ready.length} />
        <Stat label="Duplicates" value={dups.length} color={dups.length ? colors.warning : undefined} />
        <Stat label="Errors" value={failing.length} color={failing.length ? colors.destructive : undefined} />
      </View>

      {failing.length > 0 && (
        <Banner tone="error">
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.destructive }}>
              {failing.length} item{failing.length === 1 ? "" : "s"} can’t be imported yet. Fix them, or exclude them to import the rest.
            </Text>
            <Button title={`Exclude ${failing.length} failed`} size="sm" variant="outline" icon="remove-circle-outline" onPress={() => failing.forEach((i) => onChange(i.key, { excluded: true }))} />
          </View>
        </Banner>
      )}

      {dups.length > 1 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <Muted>All duplicates:</Muted>
          {(["skip", "replace", "add"] as DuplicateAction[]).map((a) => (
            <Chip key={a} label={ACTION_LABEL[a]} onPress={() => dups.forEach((d) => onChange(d.key, { duplicateAction: a === "replace" && !d.duplicateOf ? "skip" : a }))} />
          ))}
        </View>
      )}

      {spares.length > 0 && (
        <Banner tone="warning">
          {`${spares.length} photo${spares.length === 1 ? " isn't" : "s aren't"} referenced by the JSON: ${spares.join(", ")}. Assign ${spares.length === 1 ? "it" : "them"} to an item below, or ${spares.length === 1 ? "it" : "they"} will be ignored.`}
        </Banner>
      )}

      {items.map((item) => (
        <Row
          key={item.key}
          item={item}
          canAssign={spares.length > 0}
          onChange={(p) => onChange(item.key, p)}
          onEdit={() => {
            setEditing(item);
            setDraft(item.input ?? item.draft ?? { ...emptyClothingInput(), name: item.label.startsWith("Item #") ? "" : item.label });
          }}
          onAssign={() => setAssigning(item)}
        />
      ))}

      <Muted style={{ textAlign: "center" }}>
        {ready.filter(willSend).length} to import{items.some((i) => i.excluded) ? ` · ${items.filter((i) => i.excluded).length} excluded` : ""}
      </Muted>

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit before import"
        description="Your changes replace what Claude generated for this item."
        tall
        footer={
          <Button
            title="Done"
            style={{ flex: 1 }}
            onPress={() => {
              if (editing && draft) onChange(editing.key, { input: draft, label: draft.name || editing.label, errors: editing.errors.filter((e) => /image|photo/i.test(e)), edited: true });
              setEditing(null);
            }}
          />
        }
      >
        {draft && <ClothingForm value={draft} onChange={setDraft} />}
      </Sheet>

      <Sheet visible={assigning !== null} onClose={() => setAssigning(null)} title="Assign a photo" description={assigning ? `For “${assigning.input?.name || assigning.label}”` : undefined}>
        <View style={{ gap: 8 }}>
          {spares.map((name) => (
            <Button
              key={name}
              title={name}
              variant="outline"
              onPress={() => {
                if (assigning) onAssign(assigning.key, name);
                setAssigning(null);
              }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const colors = useColors();
  return (
    <Card style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}>
      <Text style={{ fontSize: 20, fontWeight: "600", color: color ?? colors.foreground }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{label}</Text>
    </Card>
  );
}

function Row({ item, canAssign, onChange, onEdit, onAssign }: { item: PreviewItem; canAssign: boolean; onChange: (p: Partial<PreviewItem>) => void; onEdit: () => void; onAssign: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const errors = blockingErrors(item);
  const input = item.input;
  return (
    <Card style={[{ padding: 12 }, errors.length > 0 && !item.excluded && { borderColor: colors.errorBorder }, item.excluded && { opacity: 0.5 }]}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={styles.photo}>
          {item.staged ? (
            <Image source={{ uri: item.staged.path }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: "center", padding: 6 }}>No photo</Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: colors.foreground }}>
              <Text style={{ color: colors.mutedForeground }}>#{item.index + 1} </Text>
              {input?.name || item.label}
            </Text>
            {item.edited && <Badge label="Edited" tone="success" />}
          </View>
          {input && (
            <>
              <Muted>{[categoryLabel(input.category), humanize(input.subcategory)].filter(Boolean).join(" › ")}</Muted>
              {(input.primaryColor || input.secondaryColors.length > 0) && (
                <Text style={{ fontSize: 13 }}>{[input.primaryColor, ...input.secondaryColors].filter(Boolean).map((c) => humanize(c)).join(", ")}</Text>
              )}
              {input.styles.length > 0 && <Muted>{input.styles.map((s) => humanize(s)).join(", ")}</Muted>}
              {input.tags.length > 0 && <Muted numberOfLines={1} style={{ fontSize: 11 }}>{input.tags.map((t) => `#${t}`).join(" ")}</Muted>}
            </>
          )}
          <Muted numberOfLines={1} style={{ fontSize: 11 }}>
            {item.photoName ?? (item.imageRef ? `image: ${item.imageRef}` : "no image reference")}
            {item.matchNote ? ` · ${item.matchNote}` : ""}
          </Muted>
        </View>
      </View>

      {!item.excluded && errors.length > 0 && (
        <View style={{ marginTop: 10, backgroundColor: colors.errorBg, borderRadius: radius.md, padding: 10, gap: 2 }}>
          {errors.map((e) => (
            <Text key={e} style={{ fontSize: 12, color: colors.destructive }}>• {e}</Text>
          ))}
        </View>
      )}
      {!item.excluded && errors.length === 0 && item.warnings.length > 0 && (
        <View style={{ marginTop: 8 }}>
          {item.warnings.map((w) => (
            <Muted key={w} style={{ fontSize: 11 }}>⚠︎ {w}</Muted>
          ))}
        </View>
      )}

      {!item.excluded && isDuplicate(item) && errors.length === 0 && (
        <View style={{ marginTop: 10, backgroundColor: colors.warningBg, borderRadius: radius.md, padding: 10, gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: "500" }}>
            {item.duplicateOf ? "This clothing image already exists." : `Same photo as item #${(item.duplicateInBatch ?? 0) + 1} in this import.`}
          </Text>
          {item.duplicateOf && <Muted numberOfLines={1}>Existing: {item.duplicateOf.name}</Muted>}
          <Segmented
            value={item.duplicateAction}
            onChange={(a) => onChange({ duplicateAction: a })}
            options={(["skip", "replace", "add"] as DuplicateAction[]).filter((a) => a !== "replace" || item.duplicateOf).map((a) => ({ value: a, label: ACTION_LABEL[a] }))}
          />
          {item.duplicateAction === "replace" && <Muted style={{ fontSize: 11 }}>Fields you edited by hand on the existing item are kept.</Muted>}
        </View>
      )}

      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 4, marginTop: 8 }}>
        {item.excluded ? (
          <Button title="Include" icon="arrow-undo-outline" size="sm" variant="ghost" onPress={() => onChange({ excluded: false })} />
        ) : (
          <>
            {!item.staged && canAssign && <Button title="Assign photo" icon="image-outline" size="sm" variant="ghost" onPress={onAssign} />}
            <Button title={item.input ? "Edit" : "Fix"} icon="pencil-outline" size="sm" variant="ghost" onPress={onEdit} />
            <Button title="Exclude" icon="remove-circle-outline" size="sm" variant="ghost" onPress={() => onChange({ excluded: true })} />
          </>
        )}
      </View>
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  photo: { width: 84, aspectRatio: 3 / 4, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
});
