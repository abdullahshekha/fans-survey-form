import { createBrowserSupabase } from "@/lib/supabase/browser";
import { buildSurveyPayload, type SurveyFormValues } from "@/lib/validation";
import { uploadSurveyMedia, uploadEditedMedia, type MediaSlot, type AudioSlot } from "@/lib/upload";

export async function submitSurvey(v: SurveyFormValues): Promise<string> {
  const supabase = createBrowserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session has expired. Sign in again.");

  const surveyId = crypto.randomUUID();
  const paths = await uploadSurveyMedia(supabase, user.id, surveyId, v);
  const payload = buildSurveyPayload(surveyId, v, paths);

  const { error } = await supabase.rpc("create_survey", { payload });
  if (error) throw new Error(`Could not save the survey: ${error.message}`);
  return surveyId;
}

export interface SurveyEditInput {
  values: SurveyFormValues;
  media: { front: MediaSlot; inner: MediaSlot[]; quotation: MediaSlot[]; audio: AudioSlot };
  originalPhotoPaths: string[];
  originalAudioPath: string | null;
}

export async function updateSurvey(surveyId: string, input: SurveyEditInput): Promise<void> {
  const supabase = createBrowserSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session has expired. Sign in again.");

  const paths = await uploadEditedMedia(supabase, user.id, surveyId, input.media);
  const payload = buildSurveyPayload(surveyId, input.values, paths);

  const { error } = await supabase.rpc("update_survey", { payload });
  if (error) throw new Error(`Could not save your changes: ${error.message}`);

  const kept = new Set<string>([paths.front, ...paths.inner, ...paths.quotation]);
  const removedPhotos = input.originalPhotoPaths.filter((p) => !kept.has(p));
  if (removedPhotos.length) await supabase.storage.from("survey-photos").remove(removedPhotos);
  if (input.originalAudioPath && input.originalAudioPath !== paths.audio) {
    await supabase.storage.from("survey-audio").remove([input.originalAudioPath]);
  }
}
