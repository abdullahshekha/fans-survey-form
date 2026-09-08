"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { SIGNED_URL_TTL } from "@/lib/constants";

export async function getSignedMediaUrls(surveyId: string): Promise<{
  photos: { kind: "front" | "inner" | "quotation"; url: string }[];
  audio: string | null;
}> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("surveys")
    .select("audio_path, survey_photos(kind, storage_path, sort_order)")
    .eq("id", surveyId)
    .single();
  if (error || !data) return { photos: [], audio: null };

  const rank: Record<string, number> = { front: 0, inner: 1, quotation: 2 };
  const ordered = [...(data.survey_photos as any[])].sort((a, b) =>
    rank[a.kind] === rank[b.kind] ? a.sort_order - b.sort_order : rank[a.kind] - rank[b.kind]);

  const { data: signed } = await supabase.storage
    .from("survey-photos")
    .createSignedUrls(ordered.map((p) => p.storage_path), SIGNED_URL_TTL);

  const byPath = new Map((signed ?? []).map((s: any) => [s.path, s.signedUrl]));
  const photos = ordered
    .map((p) => ({ kind: p.kind as "front" | "inner" | "quotation", url: byPath.get(p.storage_path) as string }))
    .filter((p) => !!p.url);

  let audio: string | null = null;
  if (data.audio_path) {
    const { data: a } = await supabase.storage.from("survey-audio").createSignedUrl(data.audio_path, SIGNED_URL_TTL);
    audio = a?.signedUrl ?? null;
  }
  return { photos, audio };
}
