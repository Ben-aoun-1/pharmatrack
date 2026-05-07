import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Dashboard shell. Totals and live register cards are wired up in Phase 4;
// for now these are static placeholders.
export default function DashboardPage() {
  const totals = [
    { label: "Ventes aujourd'hui", value: "--" },
    { label: "Cette semaine", value: "--" },
    { label: "Ce mois", value: "--" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        {totals.map((total) => (
          <Card key={total.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {total.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{total.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Caisses actives</h2>
        <Skeleton className="h-24 w-full" />
      </section>
    </div>
  );
}
