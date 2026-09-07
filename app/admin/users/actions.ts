"use server";
import { revalidatePath } from "next/cache";
import { getSessionProfile, usernameToEmail } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

async function assertAdmin() {
  const p = await getSessionProfile();
  if (!p || p.role !== "admin") throw new Error("Not authorized");
}

export async function createRep(_prev: unknown, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  await assertAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!USERNAME_RE.test(username)) return { error: "Username must be 3–32 lowercase letters, digits, dot, dash or underscore." };
  if (!full_name) return { error: "Full name is required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const db = createAdminSupabase();
  const { data: dupe } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
  if (dupe) return { error: "A user with that username already exists." };

  const { data, error } = await db.auth.admin.createUser({
    email: usernameToEmail(username), password, email_confirm: true,
  });
  if (error || !data.user) return { error: error?.message ?? "Could not create the account." };

  const { error: profileError } = await db.from("profiles").upsert(
    { id: data.user.id, username, full_name, role: "rep", active: true },
    { onConflict: "id" },
  );
  if (profileError) return { error: profileError.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setRepActive(repId: string, active: boolean): Promise<void> {
  await assertAdmin();
  const db = createAdminSupabase();
  await db.from("profiles").update({ active }).eq("id", repId).eq("role", "rep");
  if (active === false) {
    // Revoke every live session so a deactivated rep is booted immediately,
    // not just blocked at the DB layer on their next insert.
    try {
      await db.auth.admin.signOut(repId, "global");
    } catch {
      // A signOut failure must not fail the whole action; the DB-layer
      // check still stops the deactivated rep from writing.
    }
  }
  revalidatePath("/admin/users");
}

export async function resetRepPassword(repId: string, newPassword: string): Promise<{ error?: string; ok?: boolean }> {
  await assertAdmin();
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters." };
  const db = createAdminSupabase();
  const { error } = await db.auth.admin.updateUserById(repId, { password: newPassword });
  if (error) return { error: error.message };
  return { ok: true };
}
