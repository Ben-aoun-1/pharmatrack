"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PharmacyOption = { id: string; name: string };

export function UploadDbForm() {
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [target, setTarget] = useState("global");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load the pharmacy list for the target select.
  useEffect(() => {
    fetch("/api/admin/pharmacies")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PharmacyOption[]) => setPharmacies(data))
      .catch(() => setPharmacies([]));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!file) {
      setError("Veuillez sélectionner un fichier .sqlite.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pharmacy_id", target);

      const response = await fetch("/api/admin/upload-db", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Échec de la mise à jour.");
        return;
      }

      setSuccess(`Base de données mise à jour — version ${data.version}`);
      setFile(null);
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mettre à jour la base de données</CardTitle>
        <CardDescription>
          Importez un fichier SQLite pour une pharmacie ou pour toutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="db-file">Fichier de base de données (.sqlite)</Label>
            <Input
              id="db-file"
              type="file"
              accept=".sqlite"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="db-target">Pharmacie cible</Label>
            <select
              id="db-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <option value="global">Toutes les pharmacies (global)</option>
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm font-medium text-green-700">{success}</p>
          )}

          <Button type="submit" disabled={loading} className="w-fit">
            {loading ? "Mise à jour…" : "Mettre à jour la base de données"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
