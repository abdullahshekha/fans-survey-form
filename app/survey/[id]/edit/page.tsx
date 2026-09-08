import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSignedMediaUrls } from "../actions";
import { EditClient } from "./EditClient";
import type { SurveyWithRelations } from "@/lib/types";

export default async function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("surveys")
    .select("*, rep:profiles!surveys_rep_id_fkey(id, username, full_name), photos:survey_photos(*)")
    .eq("id", id)
    .single();
  if (error || !data) notFound();

  // Owner rep only. Admin editing is out of scope for this feature.
  if (data.rep_id !== profile.id) notFound();

  const signed = await getSignedMediaUrls(id);

  return (
    <EditClient
      survey={data as SurveyWithRelations}
      media={{ photos: signed.photos, audioUrl: signed.audio }}
    />
  );
}
