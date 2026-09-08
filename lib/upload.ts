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
    const ext = extFromAudioMime(v.audio.type);
    const p = `${base}/comment.${ext}`;
    const res = await supabase.storage.from(AUDIO_BUCKET).upload(p, v.audio, { contentType: v.audio.type });
    if (res.error) throw new Error(`Voice note upload failed: ${res.error.message}`);
    audio = p;
  }

  return { front: frontPath, inner, quotation, audio };
}

export type MediaSlot = { keep: string } | { file: File };
export type AudioSlot = { keep: string } | { file: Blob } | null;

const AUDIO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

export function extFromAudioMime(type: string): string {
  return AUDIO_EXT[type] ?? "bin";
}

export async function uploadEditedMedia(
  supabase: SupabaseClient,
  repUid: string,
  surveyId: string,
  media: { front: MediaSlot; inner: MediaSlot[]; quotation: MediaSlot[]; audio: AudioSlot },
): Promise<{ front: string; inner: string[]; quotation: string[]; audio: string | null }> {
  const base = `${repUid}/${surveyId}`;

  async function putPhoto(slot: MediaSlot, kind: string): Promise<string> {
    if ("keep" in slot) return slot.keep;
    const path = `${base}/${kind}-${crypto.randomUUID()}.jpg`;
    const res = await supabase.storage.from(PHOTO_BUCKET).upload(path, slot.file, { contentType: "image/jpeg" });
    if (res.error) throw new Error(`Photo upload failed: ${res.error.message}`);
    return path;
  }

  const front = await putPhoto(media.front, "front");
  const inner: string[] = [];
  for (const s of media.inner) inner.push(await putPhoto(s, "inner"));
  const quotation: string[] = [];
  for (const s of media.quotation) quotation.push(await putPhoto(s, "quotation"));

  let audio: string | null = null;
  if (media.audio) {
    if ("keep" in media.audio) {
      audio = media.audio.keep;
    } else {
      const type = media.audio.file.type || "application/octet-stream";
      const path = `${base}/comment-${crypto.randomUUID()}.${extFromAudioMime(media.audio.file.type)}`;
      const res = await supabase.storage.from(AUDIO_BUCKET).upload(path, media.audio.file, { contentType: type });
      if (res.error) throw new Error(`Voice note upload failed: ${res.error.message}`);
      audio = path;
    }
  }

  return { front, inner, quotation, audio };
}
