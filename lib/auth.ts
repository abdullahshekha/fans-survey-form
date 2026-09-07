import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export function usernameToEmail(username: string): string {
  const domain = process.env.REP_EMAIL_DOMAIN ?? "survey.local";
  return `${username.trim().toLowerCase()}@${domain}`;
}

export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
}
