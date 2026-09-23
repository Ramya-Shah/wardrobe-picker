"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { CopyBlock } from "@/components/common/copy-block";
import { filenameListMessage, WARDROBE_PROMPT } from "@/lib/export/claude-prompt";

/** Shows the Claude prompt; optionally appends the filename list for the photos you are about to send. */
export function PromptHelper() {
  const [names, setNames] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const text = names.length ? `${WARDROBE_PROMPT}\n${filenameListMessage(names)}\n` : WARDROBE_PROMPT;
  return (
    <div className="space-y-4">
      <input ref={ref} type="file" multiple accept="image/*" className="hidden" onChange={(e) => setNames(Array.from(e.target.files ?? []).map((f) => f.name))} />
      <button type="button" onClick={() => ref.current?.click()} className="flex w-full items-center gap-3 rounded-2xl border border-dashed bg-card px-4 py-3 text-left">
        <ImagePlus className="size-5 shrink-0 text-muted-foreground" />
        <span className="text-sm">
          {names.length ? `Filename list added for ${names.length} photo${names.length === 1 ? "" : "s"}` : "Optional: pick the photos you'll send to add their filenames to the prompt"}
          <span className="block text-xs text-muted-foreground">Photos are only read for their names — nothing is uploaded.</span>
        </span>
      </button>
      <CopyBlock text={text} filename="claude-wardrobe-prompt.txt" label="Copy prompt" rows={14} />
    </div>
  );
}
