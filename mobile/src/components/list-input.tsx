import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { humanize } from "@/lib/constants/categories";
import { Chip } from "~/ui/primitives";
import { colors, radius } from "~/ui/theme";

/** Editable list of short values (tags, colors, occasions…) as removable chips, with one-tap suggestions. */
export function ListInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add…",
  quickPick = false,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  /** Show all suggestions as toggle chips (short vocabularies like seasons). */
  quickPick?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const next = [...value];
    for (const p of raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft("");
  };
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  if (quickPick) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[...suggestions, ...value.filter((v) => !suggestions.includes(v))].map((s) => (
          <Chip key={s} label={humanize(s)} active={value.includes(s)} onPress={() => toggle(s)} />
        ))}
      </View>
    );
  }

  const open = suggestions.filter((s) => !value.includes(s) && (!draft || s.includes(draft.toLowerCase()))).slice(0, 8);
  return (
    <View style={styles.box}>
      {value.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((v) => (
            <Pressable key={v} onPress={() => toggle(v)} accessibilityLabel={`Remove ${v}`} style={styles.pill}>
              <Text style={{ fontSize: 14 }}>{v}</Text>
              <Ionicons name="close" size={14} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          value={draft}
          onChangeText={(t) => (t.endsWith(",") ? add(t) : setDraft(t))}
          onSubmitEditing={() => draft.trim() && add(draft)}
          onBlur={() => draft.trim() && add(draft)}
          submitBehavior="submit"
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          returnKeyType="done"
          style={{ flex: 1, fontSize: 16, color: colors.foreground, minHeight: 36, paddingHorizontal: 4 }}
        />
        {draft.trim() ? (
          <Pressable onPress={() => add(draft)} accessibilityLabel="Add" style={styles.add}>
            <Ionicons name="add" size={18} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>
      {open.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {open.map((s) => (
            <Pressable key={s} onPress={() => add(s)} style={styles.suggestion}>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>+ {humanize(s)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.input, borderRadius: radius.md, backgroundColor: colors.card, padding: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingLeft: 12, paddingRight: 8, borderRadius: radius.full, backgroundColor: colors.muted },
  add: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
  suggestion: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
});
