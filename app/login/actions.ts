"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/auth";

export async function signIn(_prev: unknown, formData: FormData): Promise<{ error: string }> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const supabase = await createServerSupabase();
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error || !auth.user) return { error: "Incorrect username or password." };

  const { data: profile } = await supabase.from("profiles")
    .select("role, active").eq("id", auth.user.id).single();
  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    return { error: "This account is inactive. Contact your administrator." };
  }
  redirect(profile.role === "admin" ? "/admin/overview" : "/dashboard");
}
