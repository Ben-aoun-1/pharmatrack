// Shared domain types for the dashboard and API layer.

export type Transaction = {
  id: string;
  pharmacy_id: string;
  register_id: string;
  barcode: string;
  drug_name: string;
  selling_price: number;
  is_price_unverified: boolean;
  created_at: string;
  registers?: { label: string };
};

export type Register = {
  id: string;
  pharmacy_id: string;
  machine_id: string;
  label: string;
  last_seen_at: string;
};

export type Pharmacy = {
  id: string;
  name: string;
  owner_id: string;
  license_key: string;
  created_at: string;
};
