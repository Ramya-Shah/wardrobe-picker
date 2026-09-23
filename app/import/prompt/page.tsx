import { PageBody, PageHeader } from "@/components/layout/page-header";
import { PromptHelper } from "@/components/import/prompt-helper";

export const metadata = { title: "Claude prompt" };

export default function PromptPage() {
  return (
    <>
      <PageHeader title="Claude prompt" backHref="/import" />
      <PageBody className="space-y-5 pt-2">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Copy this prompt into a new Claude chat.</li>
          <li>Attach your clothing photos (1 or many; ~20 per message works well).</li>
          <li>Copy Claude&apos;s JSON reply and paste it in Import from Claude, together with the same photos.</li>
        </ol>
        <PromptHelper />
        <p className="text-xs text-muted-foreground">Same text as docs/CLAUDE_WARDROBE_PROMPT.md in the project.</p>
      </PageBody>
    </>
  );
}
