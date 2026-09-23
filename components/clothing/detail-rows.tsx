import { humanize } from "@/lib/constants/categories";
import type { ClothingItem, EditableField } from "@/lib/types";
import { fieldOrigin, OriginMark } from "./provenance";

type Row = { field: EditableField; label: string; value: string | string[] | null };

function RowValue({ value }: { value: string | string[] }) {
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap justify-end gap-1">
        {value.map((v) => (
          <span key={v} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
            {humanize(v)}
          </span>
        ))}
      </span>
    );
  }
  return <span className="text-right">{humanize(value)}</span>;
}

/** Label/value list; empty values are skipped, each value shows where it came from. */
export function DetailRows({ item, rows }: { item: ClothingItem; rows: Row[] }) {
  const visible = rows.filter((r) => (Array.isArray(r.value) ? r.value.length > 0 : Boolean(r.value)));
  if (visible.length === 0) return null;
  return (
    <dl className="divide-y rounded-2xl border bg-card">
      {visible.map((r) => (
        <div key={r.field + r.label} className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            {r.label}
            <OriginMark origin={fieldOrigin(item, r.field)} />
          </dt>
          <dd className="min-w-0">
            <RowValue value={r.value as string | string[]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
