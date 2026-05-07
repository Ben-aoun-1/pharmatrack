import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Shared shell for every authenticated page. Acts as the route guard: any
// request without a valid session is bounced to /login before children render.
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Admin nav is only shown to operators flagged in their user metadata.
  const isAdmin = user.user_metadata?.is_admin === true;

  const navLinks = (
    <>
      <Link
        href="/dashboard"
        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
      >
        Tableau de bord
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Admin
        </Link>
      )}
    </>
  );

  const signOutButton = (
    <form action="/api/auth/signout" method="post">
      <Button type="submit" variant="outline" size="sm" className="w-full">
        Se déconnecter
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar — desktop only */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-sidebar md:flex">
        <div className="px-6 py-5">
          <span className="text-xl font-bold tracking-tight">PharmTrack</span>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 p-4">{navLinks}</nav>
        <Separator />
        <div className="flex flex-col gap-3 p-4">
          <span className="truncate text-sm text-muted-foreground">
            {user.email}
          </span>
          {signOutButton}
        </div>
      </aside>

      {/* Top bar — mobile only */}
      <header className="flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
        <span className="text-lg font-bold tracking-tight">PharmTrack</span>
        <nav className="flex items-center gap-1">{navLinks}</nav>
        <div className="w-28">{signOutButton}</div>
      </header>

      {/* Main content */}
      <main className="flex-1 md:pl-64">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}
