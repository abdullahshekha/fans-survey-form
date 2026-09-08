import type { SupabaseClient } from "@supabase/supabase-js";
import type { SurveyFormValues } from "./validation";

const PHOTO_BUCKET = "survey-photos";
const AUDIO_BUCKET = "survey-audio";

export async function uploadSurveyMedia(
  supabase: SupabaseClient,
  repUid: string,
  surveyId: string,
  v: SurveyFormValues,
): Promise<{ front: string; inner: string[]; quotation: string[]; audio: string | null }> {
  const base = `${repUid}/${surveyId}`;

  const frontPath = `${base}/front.jpg`;
  const front = await supabase.storage.from(PHOTO_BUCKET).upload(frontPath, v.frontPhoto!, { contentType: "image/jpeg" });
  if (front.error) throw new Error(`Photo upload failed: ${front.error.message}`);

  const inner: string[] = [];
  for (let i = 0; i < v.innerPhotos.length; i++) {
    const p = `${base}/inner-${i}.jpg`;
    const res = await supabase.storage.from(PHOTO_BUCKET).upload(p, v.innerPhotos[i], { contentType: "image/jpeg" });
    if (res.error) throw new Error(`Photo upload failed: ${res.error.message}`);
    inner.push(p);
  }

  const quotation: string[] = [];
  for (let i = 0; i < v.quotationPhotos.length; i++) {
    const p = `${base}/quotation-${i}.jpg`;
    const res = await supabase.storage.from(PHOTO_BUCKET).upload(p, v.quotationPhotos[i], { contentType: "image/jpeg" });
    if (res.error) throw new Error(`Photo upload failed: ${res.error.message}`);
    quotation.push(p);
  }

  let audio: string | null = null;
  if (v.audio) {
    const ext = v.audio.type.includes("mp4") ? "mp4" : "webm";
    const p = `${base}/comment.${ext}`;
    const res = await supabase.storage.from(AUDIO_BUCKET).upload(p, v.audio, { contentType: v.audio.type });
    if (res.error) throw new Error(`Voice note upload failed: ${res.error.message}`);
    audio = p;
  }

  return { front: frontPath, inner, quotation, audio };
}
