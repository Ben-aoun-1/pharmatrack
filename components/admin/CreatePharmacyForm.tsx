"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

const EXE_DOWNLOAD_URL =
  "https://njiuwlscshpucsfbsquu.supabase.co/storage/v1/object/public/releases/PharmTrack.exe";

type CreateResult = {
  pharmacy_id: string;
  license_key: string;
  owner_email: string;
  name: string;
};

export function CreatePharmacyForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/create-pharmacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Échec de la création.");
        return;
      }

      setResult({
        pharmacy_id: data.pharmacy_id,
        license_key: data.license_key,
        owner_email: data.owner_email,
        name,
      });
      setName("");
      setEmail("");
      setPassword("");
      // Refresh the server-rendered pharmacy list.
      router.refresh();
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer une pharmacie</CardTitle>
        <CardDescription>
          Crée le compte propriétaire et génère une clé de licence unique.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pharmacy-name">Nom de la pharmacie</Label>
            <Input
              id="pharmacy-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="owner-email">Email du propriétaire</Label>
            <Input
              id="owner-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="owner-password">Mot de passe</Label>
            <Input
              id="owner-password"
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-fit">
            {loading ? "Création…" : "Créer la pharmacie"}
          </Button>
        </form>

        {result && (
          <div className="mt-6 flex flex-col gap-3 rounded-md border border-green-600 bg-green-50 p-4">
            <p className="font-semibold text-green-800">
              Pharmacie créée avec succès
            </p>
            <div className="text-sm text-green-900">
              <p>
                <span className="font-medium">Pharmacie :</span> {result.name}
              </p>
              <p>
                <span className="font-medium">Propriétaire :</span>{" "}
                {result.owner_email}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-green-900">
                Clé de licence
              </span>
              <code className="select-all break-all rounded bg-white px-3 py-2 text-base font-bold tracking-wide text-green-900 ring-1 ring-green-600">
                {result.license_key}
              </code>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-green-900">
                Lien de téléchargement de l&apos;agent
              </span>
              <a
                href={EXE_DOWNLOAD_URL}
                className="break-all text-sm text-green-800 underline"
              >
                {EXE_DOWNLOAD_URL}
              </a>
            </div>

            <p className="text-sm text-green-900">
              Envoyez cette clé et ce lien à la pharmacie. La clé est unique et
              ne peut pas être récupérée.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
