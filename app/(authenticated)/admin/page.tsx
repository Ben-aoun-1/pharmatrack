import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { CreatePharmacyForm } from "@/components/admin/CreatePharmacyForm";
import { UploadDbForm } from "@/components/admin/UploadDbForm";

export default async function AdminPage() {
  // Block non-admins outright (no redirect, just deny).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.is_admin !== true) {
    return <p>Accès refusé.</p>;
  }

  const admin = createAdminClient();

  const { data: pharmaciesData } = await admin
    .from("pharmacies")
    .select("id, name, license_key, owner_id, created_at")
    .order("created_at", { ascending: false });
  const pharmacies = pharmaciesData ?? [];

  const { data: registersData } = await admin
    .from("registers")
    .select("pharmacy_id");

  const { data: usersData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  // owner_id → email and pharmacy_id → register count.
  const emailById = new Map<string, string>();
  for (const u of usersData?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }
  const registerCount = new Map<string, number>();
  for (const r of registersData ?? []) {
    if (r.pharmacy_id) {
      registerCount.set(
        r.pharmacy_id,
        (registerCount.get(r.pharmacy_id) ?? 0) + 1,
      );
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground">
          {pharmacies.length} pharmacie(s)
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nom</th>
              <th className="px-4 py-2 font-medium">Clé de licence</th>
              <th className="px-4 py-2 font-medium">Propriétaire</th>
              <th className="px-4 py-2 font-medium">Caisses</th>
              <th className="px-4 py-2 font-medium">Créée le</th>
            </tr>
          </thead>
          <tbody>
            {pharmacies.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-4 text-center text-muted-foreground"
                >
                  Aucune pharmacie.
                </td>
              </tr>
            ) : (
              pharmacies.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2">
                    <code className="break-all text-xs">{p.license_key}</code>
                  </td>
                  <td className="px-4 py-2">
                    {p.owner_id ? (emailById.get(p.owner_id) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {registerCount.get(p.id) ?? 0}
                  </td>
                  <td className="px-4 py-2">{formatDate(p.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreatePharmacyForm />
      <UploadDbForm />
    </div>
  );
}
