-- ============================================================================
-- PharmTrack — Database Schema
-- Runnable as-is in the Supabase SQL editor.
--
-- Source of truth: CLAUDE.md sections 5 (schema) and 6 (pricing).
-- Multi-tenant: one backend serves many pharmacies. Each pharmacy is isolated;
-- an owner can only ever read their own data. Isolation is enforced by RLS.
--
-- Migration log:
--   2026-06-01  Initial schema (Phase 1). Five tables, RLS enabled on all,
--               owner-scoped SELECT policies. Writes happen via the service-role
--               client in API routes / scripts, which bypasses RLS by design.
-- Migration 2: added is_price_unverified to transactions (Phase 3)
--               Set true when a sale's barcode is unknown to the drugs table, so
--               the agent-sent price is kept but flagged instead of trusted.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: pharmacies
-- ----------------------------------------------------------------------------
create table if not exists public.pharmacies (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    owner_id    uuid references auth.users,
    license_key uuid unique default gen_random_uuid(),
    created_at  timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- Table: registers
-- ----------------------------------------------------------------------------
create table if not exists public.registers (
    id           uuid primary key default gen_random_uuid(),
    pharmacy_id  uuid references public.pharmacies on delete cascade,
    machine_id   text not null,            -- generated on first agent launch (uuid)
    label        text default 'Caisse',    -- e.g. "Caisse 1", editable by owner
    last_seen_at timestamptz,
    unique (pharmacy_id, machine_id)
);

-- ----------------------------------------------------------------------------
-- Table: transactions
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
    id            uuid primary key default gen_random_uuid(),
    pharmacy_id   uuid references public.pharmacies on delete cascade,
    register_id   uuid references public.registers on delete cascade,
    barcode       text not null,            -- CODE_PCT (7 digits)
    drug_name     text not null,            -- NOM_COMMERCIAL
    selling_price numeric(10,3) not null,   -- pre-computed at import time
    is_price_unverified boolean default false, -- true when barcode unknown to drugs table
    created_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- Table: drug_db_versions
-- ----------------------------------------------------------------------------
create table if not exists public.drug_db_versions (
    id          uuid primary key default gen_random_uuid(),
    pharmacy_id uuid references public.pharmacies,  -- NULL = global default
    version     integer not null,
    sqlite_url  text not null,                       -- Supabase Storage public URL
    uploaded_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- Table: drugs (master reference table)
-- Selling price is pre-computed at import time (see CLAUDE.md section 6) and
-- never recalculated at runtime.
-- ----------------------------------------------------------------------------
create table if not exists public.drugs (
    code_pct        text primary key,        -- 7-digit barcode
    nom_commercial  text not null,
    tarif_reference numeric(10,3),
    selling_price   numeric(10,3) not null,  -- pre-computed
    categorie       text,
    ap              text,
    updated_at      timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- Indexes — support the live dashboard (sales per register, per day/week/month)
-- ----------------------------------------------------------------------------
create index if not exists idx_registers_pharmacy
    on public.registers (pharmacy_id);
create index if not exists idx_transactions_pharmacy_created
    on public.transactions (pharmacy_id, created_at desc);
create index if not exists idx_transactions_register_created
    on public.transactions (register_id, created_at desc);
create index if not exists idx_drug_db_versions_pharmacy
    on public.drug_db_versions (pharmacy_id);

-- ============================================================================
-- Row-Level Security
-- Hard constraint (CLAUDE.md section 12): every table must have RLS enabled.
--
-- Policy model:
--   * Owners (authenticated dashboard users) get owner-scoped SELECT only.
--   * All inserts/updates/deletes come from the service-role client used by
--     API routes and admin scripts, which bypasses RLS — so no write policies
--     are defined here (keeping the surface minimal, per section 9).
-- ============================================================================

alter table public.pharmacies       enable row level security;
alter table public.registers        enable row level security;
alter table public.transactions     enable row level security;
alter table public.drug_db_versions enable row level security;
alter table public.drugs            enable row level security;

-- pharmacies: an owner can read only the pharmacies they own.
drop policy if exists "owners read own pharmacies" on public.pharmacies;
create policy "owners read own pharmacies"
    on public.pharmacies
    for select
    to authenticated
    using (owner_id = auth.uid());

-- registers: readable if they belong to a pharmacy the user owns.
drop policy if exists "owners read own registers" on public.registers;
create policy "owners read own registers"
    on public.registers
    for select
    to authenticated
    using (
        pharmacy_id in (
            select id from public.pharmacies where owner_id = auth.uid()
        )
    );

-- transactions: readable if they belong to a pharmacy the user owns.
drop policy if exists "owners read own transactions" on public.transactions;
create policy "owners read own transactions"
    on public.transactions
    for select
    to authenticated
    using (
        pharmacy_id in (
            select id from public.pharmacies where owner_id = auth.uid()
        )
    );

-- drug_db_versions: readable if global (pharmacy_id IS NULL) or owned.
drop policy if exists "owners read own db versions" on public.drug_db_versions;
create policy "owners read own db versions"
    on public.drug_db_versions
    for select
    to authenticated
    using (
        pharmacy_id is null
        or pharmacy_id in (
            select id from public.pharmacies where owner_id = auth.uid()
        )
    );

-- drugs: non-sensitive master reference; readable by any authenticated user.
drop policy if exists "authenticated read drugs" on public.drugs;
create policy "authenticated read drugs"
    on public.drugs
    for select
    to authenticated
    using (true);

-- ============================================================================
-- Realtime
-- The dashboard subscribes to incoming sales (CLAUDE.md sections 4 & 13).
-- Add the transactions table to the realtime publication so INSERTs stream
-- to subscribed, RLS-authorized owners.
-- ============================================================================
alter publication supabase_realtime add table public.transactions;
