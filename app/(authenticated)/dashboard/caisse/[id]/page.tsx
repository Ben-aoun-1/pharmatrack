import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatPrice, startOfTodayISO } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { SalesFeed } from "@/components/dashboard/SalesFeed";

export default async function RegisterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pharmacy } = await supabase
    .from("pharmacies")
    .select("id")
    .eq("owner_id", user!.id)
    .maybeSingle();

  if (!pharmacy) notFound();

  // Ownership check: the register must belong to this user's pharmacy.
  const { data: register } = await supabase
    .from("registers")
    .select("id, label")
    .eq("id", id)
    .eq("pharmacy_id", pharmacy.id)
    .maybeSingle();

  if (!register) notFound();

  // Today's total + count for this register.
  const todayStart = startOfTodayISO();
  const { data: todayRows } = await supabase
    .from("transactions")
    .select("selling_price")
    .eq("register_id", register.id)
    .gte("created_at", todayStart);

  const todayCount = todayRows?.length ?? 0;
  const todayTotal = (todayRows ?? []).reduce(
    (sum, row) => sum + Number(row.selling_price),
    0,
  );

  // Last 50 transactions for this register, joined with its label.
  const { data: feedData } = await supabase
    .from("transactions")
    .select("*, registers(label)")
    .eq("register_id", register.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const initialTransactions = (feedData ?? []) as Transaction[];

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Tableau de bord
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{register.label}</h1>
        <p className="text-muted-foreground">
          <span className="text-2xl font-bold text-foreground">
            {formatPrice(todayTotal)}
          </span>{" "}
          · {todayCount} vente(s) aujourd&apos;hui
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ventes récentes</h2>
        <SalesFeed
          pharmacyId={pharmacy.id}
          registerId={register.id}
          initialTransactions={initialTransactions}
        />
      </section>
    </div>
  );
}
