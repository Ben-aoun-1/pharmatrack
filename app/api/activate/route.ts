import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validators";

// POST /api/activate — called by the Windows agent on first launch.
// Validates the license key, registers (or refreshes) the machine, and returns
// the pharmacy/register identifiers plus the current drug DB version + URL.
// Agent-facing: authenticated by license_key, never by session cookie.
export async function POST(request: Request) {
  try {
    let body: { license_key?: unknown; machine_id?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    const { license_key, machine_id } = body;

    if (
      typeof license_key !== "string" ||
      typeof machine_id !== "string" ||
      !isValidUUID(license_key) ||
      !isValidUUID(machine_id)
    ) {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Resolve the pharmacy from the license key.
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("license_key", license_key)
      .maybeSingle();

    if (pharmacyError) throw pharmacyError;
    if (!pharmacy) {
      return NextResponse.json({ error: "Licence invalide" }, { status: 403 });
    }

    // 2. Register the machine (or refresh last_seen_at if it already exists).
    const { data: register, error: registerError } = await supabase
      .from("registers")
      .upsert(
        {
          pharmacy_id: pharmacy.id,
          machine_id,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "pharmacy_id,machine_id" },
      )
      .select("id")
      .single();

    if (registerError) throw registerError;

    // 3. Latest drug DB version for this pharmacy, falling back to the global one.
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
        pharmacy_id: pharmacy.id,
        register_id: register.id,
        db_version: dbVersion?.version ?? 0,
        db_url: dbVersion?.sqlite_url ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[/api/activate] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
