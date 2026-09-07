import { createAdminSupabase } from "@/lib/supabase/admin";

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const domain = process.env.REP_EMAIL_DOMAIN ?? "survey.local";
  if (!username || !password) throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required");

  const db = createAdminSupabase();
  const email = `${username}@${domain}`;

  const { data: list } = await db.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    await db.auth.admin.updateUserById(userId, { password });
    console.log(`Updated password for existing admin ${email}`);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created admin auth user ${email}`);
  }

  const { error: upsertError } = await db.from("profiles").upsert(
    { id: userId, username, full_name: "Administrator", role: "admin", active: true },
    { onConflict: "id" },
  );
  if (upsertError) throw upsertError;
  console.log("Admin profile ready.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
