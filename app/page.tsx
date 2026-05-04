import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Entry point: send authenticated users to the dashboard, everyone else to login.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
