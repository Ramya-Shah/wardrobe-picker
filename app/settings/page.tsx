import { promises as fs } from "node:fs";
import Link from "next/link";
import { ChevronRight, Database, Download, FileJson, FileSpreadsheet, Images, MessageSquareText, Package, Shirt, Sparkles, WandSparkles } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { DangerZone } from "@/components/settings/danger-zone";
import { RestoreBackup } from "@/components/settings/restore-backup";
import { databaseFilePath } from "@/lib/config";
import { countItems } from "@/lib/db/clothing";
import { countOutfits } from "@/lib/db/outfits";
import { imageStorageStats } from "@/lib/images/storage";
import { formatBytes } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

async function fileSize(p: string | null) {
  if (!p) return null;
  try {
    return (await fs.stat(p)).size;
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const [items, outfits, storage, dbSize] = await Promise.all([countItems(), countOutfits(), imageStorageStats(), fileSize(databaseFilePath())]);

  return (
    <>
      <PageHeader large title="Settings" />
      <PageBody className="space-y-8 pt-2">
        <Section title="Storage" description="Everything is stored on this computer, in the project's data/ folder.">
          <dl className="divide-y rounded-2xl border bg-card text-sm">
            <Row label="Clothing items" value={items} />
            <Row label="Outfits" value={outfits} />
            <Row label="Photos" value={`${storage.images.files} · ${formatBytes(storage.images.bytes)}`} />
            <Row label="Thumbnails" value={`${storage.thumbs.files} · ${formatBytes(storage.thumbs.bytes)}`} />
            <Row label="Database (SQLite)" value={dbSize === null ? "—" : formatBytes(dbSize)} />
            <Row label="Location" value={<span className="font-mono text-xs">data/wardrobe.db · data/images/</span>} />
          </dl>
        </Section>

        <Section title="Claude">
          <Links
            links={[
              { href: "/import", icon: Sparkles, label: "Import Claude metadata", hint: "Photos + JSON" },
              { href: "/import/prompt", icon: MessageSquareText, label: "Claude wardrobe prompt", hint: "Copy the prompt" },
              { href: "/export", icon: Shirt, label: "Export items for Claude", hint: "Copy wardrobe context" },
              { href: "/outfits/import", icon: WandSparkles, label: "Import Claude outfit", hint: "Paste outfit JSON" },
            ]}
          />
        </Section>

        <Section title="Export & backup" description="Your data is never locked in: plain JSON, CSV, your original photos and the SQLite file.">
          <Links
            download
            links={[
              { href: "/api/backup", icon: Package, label: "Full backup (.zip)", hint: "database.json + photos" },
              { href: "/api/export/json", icon: FileJson, label: "Export wardrobe (JSON)", hint: "Human-readable" },
              { href: "/api/export/csv", icon: FileSpreadsheet, label: "Export CSV", hint: "For spreadsheets" },
              { href: "/api/backup?type=images", icon: Images, label: "Export photos (.zip)", hint: "Original images" },
              { href: "/api/backup/database", icon: Database, label: "Backup database (.db)", hint: "SQLite snapshot" },
            ]}
          />
        </Section>

        <Section title="Restore / import wardrobe" description="From a wardrobe-backup.zip made by this app.">
          <RestoreBackup />
        </Section>

        <Section title="Danger zone">
          <DangerZone />
        </Section>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Wardrobe runs entirely on your computer. No accounts, no cloud, no AI APIs — Claude is used only through your own chats.
        </p>
      </PageBody>
    </>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-lg">{title}</h2>
      {description && <p className="mb-3 text-sm text-muted-foreground">{description}</p>}
      <div className={description ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Links({
  links,
  download = false,
}: {
  links: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; hint: string }[];
  download?: boolean;
}) {
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {links.map(({ href, icon: Icon, label, hint }) => {
        const inner = (
          <>
            <Icon className="size-5 shrink-0 text-muted-foreground" />
            <span className="flex-1">
              <span className="block text-sm">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
            {download ? <Download className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          </>
        );
        const cls = "flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-accent";
        return (
          <li key={href}>
            {download ? (
              <a href={href} download className={cls}>
                {inner}
              </a>
            ) : (
              <Link href={href} className={cls}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
