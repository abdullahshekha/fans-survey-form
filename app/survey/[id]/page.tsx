import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSignedMediaUrls } from "./actions";
import { SurveyDetail } from "@/components/SurveyDetail";
import type { SurveyWithRelations } from "@/lib/types";

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const media = await getSignedMediaUrls(id);
  return <SurveyDetail survey={data as SurveyWithRelations} media={media} />;
}
