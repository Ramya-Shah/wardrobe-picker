import type { Db } from "./services";

/** App preferences stored in the on-device database (not part of wardrobe backups). */
export type ThemePreference = "system" | "light" | "dark";

export interface AppSettings {
  theme: ThemePreference;
  /** Remind to back up every N days; 0 = off. */
  backupReminderDays: number;
  /** ISO time of the last full backup made in the app, or null. */
  lastBackupAt: string | null;
  /** "Later" on the reminder hides it until this ISO time. */
  backupSnoozedUntil: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  backupReminderDays: 14,
  lastBackupAt: null,
  backupSnoozedUntil: null,
};

export const REMINDER_OPTIONS = [0, 7, 14, 30] as const;

export async function loadSettings(db: Db): Promise<AppSettings> {
  const rows = await db.all<{ key: string; value: string }>("SELECT key, value FROM Setting");
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    try {
      const v: unknown = JSON.parse(value);
      if (key === "theme" && (v === "system" || v === "light" || v === "dark")) out.theme = v;
      if (key === "backupReminderDays" && typeof v === "number" && v >= 0) out.backupReminderDays = v;
      if (key === "lastBackupAt" && (typeof v === "string" || v === null)) out.lastBackupAt = v;
      if (key === "backupSnoozedUntil" && (typeof v === "string" || v === null)) out.backupSnoozedUntil = v;
    } catch {
      // ignore corrupt values; defaults apply
    }
  }
  return out;
}

export async function saveSettings(db: Db, patch: Partial<AppSettings>): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(patch)) {
      await tx.run("INSERT INTO Setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, JSON.stringify(value ?? null)]);
    }
  });
}

/** Days since the last backup (null if never backed up). */
export function daysSinceBackup(settings: AppSettings, now = new Date()): number | null {
  if (!settings.lastBackupAt) return null;
  return Math.floor((now.getTime() - Date.parse(settings.lastBackupAt)) / 86_400_000);
}

/**
 * Should the home screen show the backup reminder?
 * Due when reminders are on, the wardrobe has something worth saving, it isn't snoozed,
 * and there has been no backup within the chosen interval.
 */
export function isBackupDue(settings: AppSettings, itemCount: number, now = new Date()): boolean {
  if (settings.backupReminderDays <= 0 || itemCount === 0) return false;
  if (settings.backupSnoozedUntil && Date.parse(settings.backupSnoozedUntil) > now.getTime()) return false;
  const days = daysSinceBackup(settings, now);
  return days === null || days >= settings.backupReminderDays;
}
