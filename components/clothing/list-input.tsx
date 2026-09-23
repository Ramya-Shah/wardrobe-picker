"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { humanize } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";

/** Editable list of short values (tags, colors, occasions…) shown as removable chips. */
export function ListInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add…",
  quickPick = false,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  /** Show suggestions as one-tap toggle chips (for short vocabularies like seasons). */
  quickPick?: boolean;
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft("");
  };

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  if (quickPick) {
    const extras = value.filter((v) => !suggestions.includes(v));
    return (
      <div className="flex flex-wrap gap-2">
        {[...suggestions, ...extras].map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={value.includes(s)}
            onClick={() => toggle(s)}
            className={cn(
              "h-9 rounded-full border px-3.5 text-sm",
              value.includes(s) ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            {humanize(s)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-input bg-card p-2 focus-within:border-ring">
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary pl-3 pr-1 text-sm">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => toggle(v)} className="flex size-6 items-center justify-center rounded-full hover:bg-accent">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1">
        <input
          id={id}
          value={draft}
          list={suggestions.length ? listId : undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={placeholder}
          enterKeyHint="done"
          className="h-9 min-w-0 flex-1 bg-transparent px-1.5 outline-none placeholder:text-muted-foreground"
        />
        {draft.trim() && (
          <button type="button" aria-label="Add" onClick={() => add(draft)} className="flex size-8 items-center justify-center rounded-full bg-secondary">
            <Plus className="size-4" />
          </button>
        )}
      </div>
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
