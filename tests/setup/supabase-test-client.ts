import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

export function serviceClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anonClient() {
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function signInAs(email: string, password: string) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}
