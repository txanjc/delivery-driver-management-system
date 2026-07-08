import { supabase } from "@/lib/supabase";

export async function signInDriver(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOutDriver() {
  return supabase.auth.signOut();
}
