import Link from "next/link";

import { formatDate, formatPrice, isRegisterActive } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type RegisterCardProps = {
  register: { id: string; label: string; last_seen_at: string | null };
  todayTotal: number;
  todayCount: number;
};

// Server component. Clickable summary card for a single register, linking to
// its detail page.
export function RegisterCard({
  register,
  todayTotal,
  todayCount,
}: RegisterCardProps) {
  const lastSeen = register.last_seen_at;
  const isActive = isRegisterActive(lastSeen);

  return (
    <Link
      href={`/dashboard/caisse/${register.id}`}
      className="block focus:outline-none"
    >
      <Card className="transition-colors hover:bg-accent">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{register.label}</CardTitle>
          {isActive ? (
            <Badge className="bg-green-600 text-white hover:bg-green-600">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold">{formatPrice(todayTotal)}</span>
          <p className="mt-1 text-sm text-muted-foreground">
            {todayCount} vente(s) aujourd&apos;hui
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Dernière activité&nbsp;:{" "}
            {lastSeen ? formatDate(lastSeen) : "—"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
