import { createServerSupabase } from "@/lib/supabase/server";
import { getMarkets } from "@/lib/markets";
import { NewSurveyClient } from "./NewSurveyClient";

export default async function NewSurveyPage() {
  const supabase = await createServerSupabase();
  const markets = await getMarkets(supabase);
  return <NewSurveyClient markets={markets.map((m) => m.name)} />;
}
