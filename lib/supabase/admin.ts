import { createClient } from "@supabase/supabase-js";

// Server-only: the `typeof window` guard below throws if this ever runs in a
// browser bundle. (No `import "server-only"` — this module is also imported by
// the standalone `scripts/seed-admin.ts`, which runs under tsx, not a bundler.)

export function createAdminSupabase() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminSupabase must never run in the browser");
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
