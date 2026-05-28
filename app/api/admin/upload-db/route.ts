import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validators";

const BUCKET = "drug-db";

// POST /api/admin/upload-db — admin only. Accepts multipart/form-data with
// `file` (the .sqlite) and `pharmacy_id` ("global" or a uuid). Uploads to the
// drug-db Storage bucket as drugs_v{N}.sqlite and records the version.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.user_metadata?.is_admin !== true) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const pharmacyIdRaw = formData.get("pharmacy_id");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }
    if (typeof pharmacyIdRaw !== "string") {
      return NextResponse.json(
        { error: "Pharmacie cible manquante" },
        { status: 400 },
      );
    }
    const isGlobal = pharmacyIdRaw === "global";
    if (!isGlobal && !isValidUUID(pharmacyIdRaw)) {
      return NextResponse.json(
        { error: "Pharmacie cible invalide" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Next version = highest existing version across all rows + 1. Keeping
    // versions globally unique avoids filename collisions in the bucket.
    const { data: latest, error: versionError } = await admin
      .from("drug_db_versions")
      .select("version")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (versionError) throw versionError;
    const nextVersion = (latest?.version ?? 0) + 1;

    const filename = `drugs_v${nextVersion}.sqlite`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filename, file, {
        contentType: "application/x-sqlite3",
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const { data: publicUrlData } = admin.storage
      .from(BUCKET)
      .getPublicUrl(filename);
    const sqliteUrl = publicUrlData.publicUrl;

    const { error: insertError } = await admin.from("drug_db_versions").insert({
      pharmacy_id: isGlobal ? null : pharmacyIdRaw,
      version: nextVersion,
      sqlite_url: sqliteUrl,
    });
    if (insertError) throw insertError;

    return NextResponse.json(
      { version: nextVersion, sqlite_url: sqliteUrl },
      { status: 201 },
    );
  } catch (error) {
    console.error("[/api/admin/upload-db] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
