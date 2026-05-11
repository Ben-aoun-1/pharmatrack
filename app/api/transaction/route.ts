import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPrice, isValidUUID } from "@/lib/validators";

// POST /api/transaction — called by the Windows agent on every F10 sale.
// Agent-facing: authenticated by license_key, never by session cookie.
//
// Trust model (CLAUDE.md §12): never store the raw price from the barcode event
// blindly. We re-verify against the trusted `drugs` table; the agent-sent price
// is only kept (and flagged) when the barcode is unknown to the server DB.
export async function POST(request: Request) {
  try {
    let body: {
      license_key?: unknown;
      machine_id?: unknown;
      barcode?: unknown;
      drug_name?: unknown;
      selling_price?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    const { license_key, machine_id, barcode, drug_name, selling_price } = body;

    // All fields must be present and the right shape.
    if (
      typeof license_key !== "string" ||
      typeof machine_id !== "string" ||
      typeof barcode !== "string" ||
      typeof drug_name !== "string" ||
      barcode.length === 0 ||
      drug_name.length === 0 ||
      selling_price === undefined ||
      selling_price === null ||
      !isValidUUID(license_key) ||
      !isValidUUID(machine_id)
    ) {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }

    // Agent-sent price must be a positive, finite number.
    if (!isValidPrice(selling_price)) {
      return NextResponse.json(
        { error: "Prix invalide" },
        { status: 400 },
      );
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
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // 2. The machine must already be activated for this pharmacy.
    const { data: register, error: registerError } = await supabase
      .from("registers")
      .select("id")
      .eq("pharmacy_id", pharmacy.id)
      .eq("machine_id", machine_id)
      .maybeSingle();

    if (registerError) throw registerError;
    if (!register) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // 3. Re-verify the price against the trusted drugs table.
    const { data: drug, error: drugError } = await supabase
      .from("drugs")
      .select("selling_price")
      .eq("code_pct", barcode)
      .maybeSingle();

    if (drugError) throw drugError;

    // Known barcode → trust the DB price. Unknown barcode → keep the agent's
    // price but flag it as unverified.
    const verifiedPrice = drug ? Number(drug.selling_price) : selling_price;
    const isPriceUnverified = !drug;

    // 4. Record the sale.
    const { data: transaction, error: insertError } = await supabase
      .from("transactions")
      .insert({
        pharmacy_id: pharmacy.id,
        register_id: register.id,
        barcode,
        drug_name,
        selling_price: verifiedPrice,
        is_price_unverified: isPriceUnverified,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // 5. Mark the register as recently active.
    const { error: touchError } = await supabase
      .from("registers")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", register.id);

    if (touchError) throw touchError;

    return NextResponse.json(
      { transaction_id: transaction.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("[/api/transaction] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
