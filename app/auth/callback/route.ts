import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for Supabase invite/magic-link/recovery emails — exchanges
// the emailed code for a real session (this app had no callback route at
// all, so invited members' links silently did nothing and they fell back
// to the sign-up form, hitting the "already registered" duplicate-signup bug).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Same-origin paths only; "//host" or "/\\host" would be an open redirect.
  const rawNext = searchParams.get("next") ?? "";
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
