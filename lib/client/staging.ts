import { apiForm, apiJson, errorMessage } from "./api";
import type { StagedFile } from "@/lib/images/staging";

export interface StageOutcome {
  file: StagedFile | null;
  duplicateOf: { id: string; name: string } | null;
  error: string | null;
}

export async function createImportSession(): Promise<string> {
  const res = await apiJson<{ sessionId: string }>("/api/import/session", "POST");
  return res.sessionId;
}

/**
 * Upload images one per request (3 in parallel) so large batches from a phone show
 * progress and a single bad file doesn't fail the rest.
 */
export async function stageFiles(
  sessionId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<File, StageOutcome>> {
  const results = new Map<File, StageOutcome>();
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      const form = new FormData();
      form.set("sessionId", sessionId);
      form.set("file", file, file.name);
      try {
        const res = await apiForm<{ file: StagedFile; duplicateOf: StageOutcome["duplicateOf"] }>("/api/import/stage", form);
        results.set(file, { file: res.file, duplicateOf: res.duplicateOf, error: null });
      } catch (e) {
        results.set(file, { file: null, duplicateOf: null, error: errorMessage(e) });
      }
      onProgress?.(++done, files.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  return results;
}
