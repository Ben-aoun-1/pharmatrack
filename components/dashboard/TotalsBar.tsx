import { createClient } from "@/lib/supabase/server";
import {
  formatPrice,
  startOfMonthISO,
  startOfTodayISO,
  startOfWeekISO,
} from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Server component. Computes today / this week / this month sales totals for a
// pharmacy in a single query (fetch from month start, partition in memory).
export async function TotalsBar({ pharmacyId }: { pharmacyId: string }) {
  const supabase = await createClient();

  const monthStart = startOfMonthISO();
  const weekStart = startOfWeekISO();
  const todayStart = startOfTodayISO();

  const { data, error } = await supabase
    .from("transactions")
    .select("selling_price, created_at")
    .eq("pharmacy_id", pharmacyId)
    .gte("created_at", monthStart);

  if (error) throw error;

  const rows = data ?? [];
  const totals = {
    today: { amount: 0, count: 0 },
    week: { amount: 0, count: 0 },
    month: { amount: 0, count: 0 },
  };

  for (const row of rows) {
    const amount = Number(row.selling_price);
    const ts = row.created_at;
    totals.month.amount += amount;
    totals.month.count += 1;
    if (ts >= weekStart) {
      totals.week.amount += amount;
      totals.week.count += 1;
    }
    if (ts >= todayStart) {
      totals.today.amount += amount;
      totals.today.count += 1;
    }
  }

  const cards = [
    { label: "Ventes aujourd'hui", data: totals.today },
    { label: "Cette semaine", data: totals.week },
    { label: "Ce mois", data: totals.month },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">
              {formatPrice(card.data.amount)}
            </span>
            <p className="mt-1 text-sm text-muted-foreground">
              {card.data.count} vente(s)
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
