"use server";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

async function assertAdmin() {
  const p = await getSessionProfile();
  if (!p || p.role !== "admin") throw new Error("Not authorized");
}

async function removeFolder(db: any, bucket: string, prefix: string) {
  const { data: files } = await db.storage.from(bucket).list(prefix);
  if (files?.length) {
    await db.storage.from(bucket).remove(files.map((f: any) => `${prefix}/${f.name}`));
  }
}

export async function deleteSurvey(surveyId: string): Promise<{ ok?: boolean; error?: string }> {
  await assertAdmin();
  const db = createAdminSupabase();
  const { data: survey, error } = await db.from("surveys").select("id, rep_id").eq("id", surveyId).single();
  if (error || !survey) return { error: "Survey not found." };

  const prefix = `${survey.rep_id}/${surveyId}`;
  await removeFolder(db, "survey-photos", prefix);
  await removeFolder(db, "survey-audio", prefix);

  const { error: delError } = await db.from("surveys").delete().eq("id", surveyId);
  if (delError) return { error: delError.message };

  revalidatePath("/admin/surveys");
  return { ok: true };
}
