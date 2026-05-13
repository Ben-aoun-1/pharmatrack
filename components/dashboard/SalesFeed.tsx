"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

const MAX_ROWS = 50;

type SalesFeedProps = {
  pharmacyId: string;
  initialTransactions: Transaction[];
  // When set, the feed shows (and subscribes to) a single register only.
  registerId?: string;
};

export function SalesFeed({
  pharmacyId,
  initialTransactions,
  registerId,
}: SalesFeedProps) {
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [connected, setConnected] = useState(false);

  // Realtime payloads carry the raw row (no joined label). Resolve labels from
  // the initial server-rendered data.
  const labelById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tx of initialTransactions) {
      if (tx.registers?.label) map[tx.register_id] = tx.registers.label;
    }
    return map;
  }, [initialTransactions]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`sales-feed-${registerId ?? pharmacyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: registerId
            ? `register_id=eq.${registerId}`
            : `pharmacy_id=eq.${pharmacyId}`,
        },
        (payload) => {
          const tx = payload.new as Transaction;
          const withLabel: Transaction = {
            ...tx,
            registers: { label: labelById[tx.register_id] ?? "Caisse" },
          };
          setTransactions((prev) => [withLabel, ...prev].slice(0, MAX_ROWS));
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pharmacyId, registerId, labelById]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-2.5 w-2.5 rounded-full",
            connected ? "animate-pulse bg-green-500" : "bg-muted-foreground",
          )}
        />
        <span className="text-sm text-muted-foreground">
          {connected ? "En direct" : "Déconnecté"}
        </span>
      </div>

      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune vente aujourd&apos;hui</p>
      ) : (
        <div className="max-h-[28rem] divide-y overflow-y-auto rounded-md border">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-4 px-4 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {tx.drug_name}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatPrice(Number(tx.selling_price))}
              </span>
              <span className="hidden shrink-0 text-muted-foreground sm:inline">
                {tx.registers?.label ?? "Caisse"}
              </span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {formatDate(tx.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
