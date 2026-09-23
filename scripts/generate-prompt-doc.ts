// Regenerates docs/CLAUDE_WARDROBE_PROMPT.md from lib/export/claude-prompt.ts.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { renderPromptMarkdown } from "../lib/export/claude-prompt";

const target = path.join(process.cwd(), "docs", "CLAUDE_WARDROBE_PROMPT.md");
writeFileSync(target, renderPromptMarkdown());
console.log(`wrote ${path.relative(process.cwd(), target)}`);
