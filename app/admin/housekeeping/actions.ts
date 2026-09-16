"use server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { MARKET_COLOR_PALETTE, MAX_MARKET_NAME_LEN } from "@/lib/constants";

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

async function checkNameCollision(db: ReturnType<typeof createAdminSupabase>, name: string): Promise<void> {
  const { data } = await db.from("markets").select("name").ilike("name", name);
  if (data?.length) throw new Error("A market with that name already exists");
}

export async function addMarket(name: string): Promise<void> {
  await assertAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Market name is required");
  if (trimmed.length > MAX_MARKET_NAME_LEN)
    throw new Error(`Market name must be ${MAX_MARKET_NAME_LEN} characters or fewer`);

  const db = createAdminSupabase();
  const { count } = await db.from("markets").select("*", { count: "exact", head: true });
  await checkNameCollision(db, trimmed);

  const color = MARKET_COLOR_PALETTE[(count ?? 0) % MARKET_COLOR_PALETTE.length];
  const { error } = await db.from("markets").insert({ name: trimmed, color, sort_order: (count ?? 0) + 1 });
  if (error) throw new Error("Could not add market");
}

export async function renameMarket(oldName: string, newName: string): Promise<void> {
  await assertAdmin();
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Market name is required");
  if (trimmed.length > MAX_MARKET_NAME_LEN)
    throw new Error(`Market name must be ${MAX_MARKET_NAME_LEN} characters or fewer`);

  const db = createAdminSupabase();
  if (trimmed.toLowerCase() !== oldName.toLowerCase()) {
    await checkNameCollision(db, trimmed);
  }

  const { error } = await db.from("markets").update({ name: trimmed }).eq("name", oldName);
  if (error) throw new Error("Could not rename market");
}
