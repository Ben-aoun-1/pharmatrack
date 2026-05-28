import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/admin/pharmacies — admin only. Returns all pharmacies with the
// owner's email (resolved via the auth admin API). Used to populate the
// UploadDbForm pharmacy select.
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.user_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: pharmacies, error } = await admin
      .from("pharmacies")
      .select("id, name, license_key, owner_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Resolve owner_id → email via the auth admin API.
    const { data: usersData } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const emailById = new Map<string, string>();
    for (const u of usersData?.users ?? []) {
      if (u.email) emailById.set(u.id, u.email);
    }

    const result = (pharmacies ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      license_key: p.license_key,
      owner_email: p.owner_id ? (emailById.get(p.owner_id) ?? null) : null,
      created_at: p.created_at,
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[/api/admin/pharmacies] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
