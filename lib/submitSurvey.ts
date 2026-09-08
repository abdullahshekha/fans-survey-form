import { createBrowserSupabase } from "@/lib/supabase/browser";
import { buildSurveyPayload, type SurveyFormValues } from "@/lib/validation";
import { uploadSurveyMedia } from "@/lib/upload";

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
