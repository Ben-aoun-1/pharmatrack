import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validators";

// GET /api/db-version?license_key=uuid — called by the agent on every launch to
// check whether a newer drug DB is available.
// Agent-facing: authenticated by license_key, never by session cookie.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const license_key = searchParams.get("license_key");

    if (!license_key || !isValidUUID(license_key)) {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Resolve the pharmacy from the license key.
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("license_key", license_key)
      .maybeSingle();

    if (pharmacyError) throw pharmacyError;
    if (!pharmacy) {
      return NextResponse.json({ error: "Licence invalide" }, { status: 403 });
    }

    // Latest drug DB version for this pharmacy, falling back to the global one.
    const { data: dbVersion, error: dbVersionError } = await supabase
      .from("drug_db_versions")
      .select("version, sqlite_url")
      .or(`pharmacy_id.eq.${pharmacy.id},pharmacy_id.is.null`)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbVersionError) throw dbVersionError;

    return NextResponse.json(
      {
        version: dbVersion?.version ?? 0,
        db_url: dbVersion?.sqlite_url ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/db-version] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
