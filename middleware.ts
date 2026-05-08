import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public paths that must never require a session:
//   /login            — the sign-in page itself
//   /api/activate     — agent-facing, authenticated by license key
//   /api/transaction  — agent-facing, authenticated by license key
//   /api/db-version   — agent-facing, authenticated by license key
const PUBLIC_PATHS = [
  "/login",
  "/api/activate",
  "/api/transaction",
  "/api/db-version",
];

export async function middleware(request: NextRequest) {
  // The official Supabase SSR pattern: keep request/response cookies in sync so
  // the access token can be silently refreshed on every request.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: refresh the session. Do not run any code between createServerClient
  // and getUser() — it can cause hard-to-debug session termination issues.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  // No session and not a public path → bounce to the login page.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Must return the supabaseResponse so refreshed auth cookies are persisted.
  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on every route except Next.js internals and the favicon.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
