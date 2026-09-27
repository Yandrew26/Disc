import { createClient } from "@supabase/supabase-js";

// ponytail: requires SUPABASE_SERVICE_ROLE_KEY in .env.local
export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
