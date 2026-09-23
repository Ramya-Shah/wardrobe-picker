"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { copyText, downloadText } from "@/lib/client/clipboard";
import { cn } from "@/lib/utils";

/** Read-only text with Copy + Download buttons (works on plain-http LAN, see lib/client/clipboard.ts). */
export function CopyBlock({
  text,
  filename,
  label = "Copy",
  rows = 10,
  className,
  primary = true,
}: {
  text: string;
  filename?: string;
  label?: string;
  rows?: number;
  className?: string;
  primary?: boolean;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("space-y-2", className)}>
      <textarea
        readOnly
        value={text}
        rows={rows}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-y rounded-xl border bg-muted/50 p-3 font-mono text-[12px] leading-relaxed outline-none"
      />
      <div className="flex gap-2">
        <Button
          className="flex-1"
          variant={primary ? "default" : "outline"}
          onClick={async () => {
            const ok = await copyText(text);
            if (ok) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
              toast("Copied — paste it into Claude");
            } else toast("Couldn't copy automatically. Select the text above and copy it.", "error");
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
        </Button>
        {filename && (
          <Button variant="outline" size="icon" aria-label="Download" onClick={() => downloadText(text, filename)}>
            <Download />
          </Button>
        )}
      </div>
    </div>
  );
}
