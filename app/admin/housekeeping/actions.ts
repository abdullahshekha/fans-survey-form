"use server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

async function assertAdmin() {
  const p = await getSessionProfile();
  if (!p || p.role !== "admin") throw new Error("Not authorized");
}

async function sweepBucket(db: any, bucket: string, liveIds: Set<string>): Promise<number> {
  let removed = 0;
  const { data: uidFolders } = await db.storage.from(bucket).list("", { limit: 1000 });
  for (const uid of uidFolders ?? []) {
    if (!uid.name) continue;
    const { data: surveyFolders } = await db.storage.from(bucket).list(uid.name, { limit: 1000 });
    for (const sf of surveyFolders ?? []) {
      if (!sf.name || liveIds.has(sf.name)) continue;
      const prefix = `${uid.name}/${sf.name}`;
      const { data: files } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
      if (files?.length) {
        await db.storage.from(bucket).remove(files.map((f: any) => `${prefix}/${f.name}`));
        removed += files.length;
      }
    }
  }
  return removed;
}

export async function sweepOrphans(): Promise<{ removedFiles: number }> {
  await assertAdmin();
  const db = createAdminSupabase();
  const { data: rows } = await db.from("surveys").select("id");
  const liveIds = new Set<string>((rows ?? []).map((r: any) => r.id));
  const a = await sweepBucket(db, "survey-photos", liveIds);
  const b = await sweepBucket(db, "survey-audio", liveIds);
  return { removedFiles: a + b };
}
