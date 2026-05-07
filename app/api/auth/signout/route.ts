import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Server-side sign-out: clears the Supabase auth cookies (the server client
// writes the cleared cookies via next/headers), then redirects to /login.
// Status 303 forces the browser to follow the redirect with a GET.
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
