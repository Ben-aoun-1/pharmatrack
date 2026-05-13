import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { startOfTodayISO } from "@/lib/utils";
import type { Register, Transaction } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { TotalsBar } from "@/components/dashboard/TotalsBar";
import { RegisterCard } from "@/components/dashboard/RegisterCard";
import { SalesFeed } from "@/components/dashboard/SalesFeed";

export default async function DashboardPage() {
  const supabase = await createClient();

  // The layout already guarantees a session; getUser here scopes the queries.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pharmacy } = await supabase
    .from("pharmacies")
    .select("id, name")
    .eq("owner_id", user!.id)
    .maybeSingle();

  if (!pharmacy) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Aucune pharmacie associée à ce compte. Contactez l&apos;administrateur.
        </p>
      </div>
    );
  }

  // Registers for this pharmacy.
  const { data: registersData } = await supabase
    .from("registers")
    .select("id, label, last_seen_at")
    .eq("pharmacy_id", pharmacy.id)
    .order("label", { ascending: true });

  const registers = (registersData ?? []) as Pick<
    Register,
    "id" | "label" | "last_seen_at"
  >[];

  // Today's sales for the whole pharmacy, aggregated per register in memory.
  const todayStart = startOfTodayISO();
  const { data: todayRows } = await supabase
    .from("transactions")
    .select("register_id, selling_price")
    .eq("pharmacy_id", pharmacy.id)
    .gte("created_at", todayStart);

  const todayByRegister: Record<string, { total: number; count: number }> = {};
  for (const row of todayRows ?? []) {
    const entry = (todayByRegister[row.register_id] ??= { total: 0, count: 0 });
    entry.total += Number(row.selling_price);
    entry.count += 1;
  }

  // Last 50 transactions, joined with the register label, newest first.
  const { data: feedData } = await supabase
    .from("transactions")
    .select("*, registers(label)")
    .eq("pharmacy_id", pharmacy.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const initialTransactions = (feedData ?? []) as Transaction[];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{pharmacy.name}</h1>

      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <TotalsBar pharmacyId={pharmacy.id} />
      </Suspense>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Caisses actives</h2>
        {registers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune caisse enregistrée pour le moment.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {registers.map((register) => (
              <RegisterCard
                key={register.id}
                register={register}
                todayTotal={todayByRegister[register.id]?.total ?? 0}
                todayCount={todayByRegister[register.id]?.count ?? 0}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ventes récentes</h2>
        <SalesFeed
          pharmacyId={pharmacy.id}
          initialTransactions={initialTransactions}
        />
      </section>
    </div>
  );
}
