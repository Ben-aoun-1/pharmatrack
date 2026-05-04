# PharmTrack — Master Project Context

> This file is the single source of truth for this project.
> Read it entirely before doing anything. Every decision you make must be consistent with what is written here.
> When in doubt, re-read this file before writing any code.

---

## 1. What is PharmTrack?

PharmTrack is a **B2B SaaS product** targeting **pharmacies in Tunisia**.

The core problem it solves: pharmacy owners cannot remotely track how much money is entering each cash register in real time. Staff scan a product barcode and press **F10** to confirm a sale on their existing Windows POS software. PharmTrack intercepts that event silently, looks up the drug price, and sends the transaction to a central server — giving the owner a live dashboard showing sales per register, per day, per week, per month.

**This is a multi-tenant system.** One backend serves many pharmacies. Each pharmacy is isolated — owners only ever see their own data.

### Business model
- Owner signs up → gets credentials + a unique license key (UUID)
- Owner installs the Windows agent on each register PC (one `.exe`, one config)
- Owner watches their dashboard from any browser (mobile-first, French UI)
- The software provider (us) manages drug DB updates centrally — pharmacies never touch the DB

---

## 2. Who are the users?

| Role | Who | What they do |
|---|---|---|
| `owner` | Pharmacy owner | Watches the dashboard, sees sales per register |
| `staff` | Cashier at register | Does nothing — agent is invisible to them |
| `admin` | Us (PharmTrack operator) | Creates pharmacies, generates license keys, uploads drug DB updates |

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Database + Auth + Realtime + Storage | **Supabase** | Managed Postgres, built-in auth, built-in realtime, file storage for SQLite distribution |
| Frontend / Dashboard | **Next.js 16 (App Router)** | SSR + client components, easy Vercel deploy |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent, mobile-responsive |
| API routes | **Next.js API routes** (`/app/api/`) | Keeps everything in one repo |
| Windows Agent | **Python 3.11** | Best library support for keyboard hooks + system tray on Windows |
| Agent packaging | **PyInstaller** | Compiles Python to a single `.exe` with no dependencies |
| Agent local DB | **SQLite** | Offline-capable drug lookup, distributed via Supabase Storage |
| Hosting | **Vercel** (frontend + API) + **Supabase** (backend) | Serverless, zero infra management |
| Language of UI | **French** | Target market is Tunisian pharmacies |

---

## 4. Repository Structure

```
pharmtrack/
├── CLAUDE.md                        ← you are here
├── .env.example                     ← all required env vars with placeholders
├── .env.local                       ← never commit this
├── .gitignore
│
├── app/                             ← Next.js 14 App Router
│   ├── layout.tsx                   ← root layout, fonts, global providers
│   ├── page.tsx                     ← redirect to /login or /dashboard
│   ├── login/
│   │   └── page.tsx
│   ├── dashboard/
│   │   ├── page.tsx                 ← vue d'ensemble: toutes caisses, total du jour
│   │   └── caisse/
│   │       └── [id]/
│   │           └── page.tsx         ← détail d'une caisse, feed temps réel
│   └── admin/
│       └── page.tsx                 ← admin only: créer pharmacie, importer DB, générer licence
│
├── app/api/                         ← Next.js API routes (called by the Windows agent)
│   ├── activate/
│   │   └── route.ts                 ← POST: validate license key, register machine, return config
│   ├── transaction/
│   │   └── route.ts                 ← POST: ingest a sale from an agent
│   └── db-version/
│       └── route.ts                 ← GET: return current DB version + download URL
│
├── components/                      ← shared React components
│   ├── ui/                          ← shadcn/ui primitives (auto-generated, do not edit manually)
│   ├── dashboard/
│   │   ├── Salesfeed.tsx            ← real-time list of incoming transactions
│   │   ├── RegisterCard.tsx         ← per-register summary card
│   │   └── TotalsBar.tsx            ← today / this week / this month totals
│   └── admin/
│       ├── CreatePharmacyForm.tsx
│       └── UploadDbForm.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                ← browser Supabase client (createClientComponentClient)
│   │   ├── server.ts                ← server Supabase client (createServerComponentClient)
│   │   └── admin.ts                 ← service role client for admin operations only
│   ├── utils.ts                     ← shared helpers (formatPrice, formatDate, etc.)
│   └── constants.ts                 ← MARGIN_BY_CATEGORY, APP_NAME, etc.
│
├── supabase/
│   ├── schema.sql                   ← full DB schema, runnable in Supabase SQL editor
│   └── seed.sql                     ← optional: test data for local dev
│
└── agent/                           ← Windows agent (Python, compiled to .exe)
    ├── main.py                      ← entry point
    ├── hooks.py                     ← global keyboard hook (pynput)
    ├── db.py                        ← SQLite drug lookup
    ├── api.py                       ← HTTP calls to /api/activate, /api/transaction, /api/db-version
    ├── tray.py                      ← system tray icon (pystray)
    ├── config.py                    ← read/write config.json (license key, machine_id, pharmacy_id)
    ├── updater.py                   ← check DB version, download new SQLite if needed
    ├── requirements.txt
    ├── pharmtrack.spec              ← PyInstaller spec file
    └── assets/
        └── icon.ico                 ← tray icon
│
└── scripts/
    ├── import_drugs.py              ← import .xlsx → Supabase drugs table + export SQLite
    └── requirements.txt
```

> **Rule:** Never create files outside this structure. If you think a new file is needed, add it to this map and explain why before creating it.

---

## 5. Database Schema

### Table: `pharmacies`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
name          text NOT NULL
owner_id      uuid REFERENCES auth.users
license_key   uuid UNIQUE DEFAULT gen_random_uuid()
created_at    timestamptz DEFAULT now()
```

### Table: `registers`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
pharmacy_id   uuid REFERENCES pharmacies ON DELETE CASCADE
machine_id    text NOT NULL           -- generated on first agent launch (uuid)
label         text DEFAULT 'Caisse'   -- e.g. "Caisse 1", editable by owner
last_seen_at  timestamptz
UNIQUE (pharmacy_id, machine_id)
```

### Table: `transactions`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
pharmacy_id   uuid REFERENCES pharmacies ON DELETE CASCADE
register_id   uuid REFERENCES registers ON DELETE CASCADE
barcode       text NOT NULL           -- CODE_PCT (7 digits)
drug_name     text NOT NULL           -- NOM_COMMERCIAL
selling_price numeric(10,3) NOT NULL  -- pre-computed at import time
created_at    timestamptz DEFAULT now()
```

### Table: `drug_db_versions`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
pharmacy_id   uuid REFERENCES pharmacies nullable   -- NULL = global default
version       integer NOT NULL
sqlite_url    text NOT NULL           -- Supabase Storage public URL
uploaded_at   timestamptz DEFAULT now()
```

### Table: `drugs` (master reference table)
```sql
code_pct      text PRIMARY KEY        -- 7-digit barcode
nom_commercial text NOT NULL
tarif_reference numeric(10,3)
selling_price  numeric(10,3) NOT NULL -- pre-computed
categorie      text
ap             text
updated_at     timestamptz DEFAULT now()
```

---

## 6. Domain Logic — Drug Pricing

Selling price is **pre-computed at import time** and stored. It is never recalculated at runtime.

```python
MARGIN_BY_CATEGORY = {
    "REMBOURSABLE": 0.28,
    "OTC":          0.33,
    "GENERIQUE":    0.30,
}
DEFAULT_MARGIN = 0.30

def compute_selling_price(tarif_reference: float, categorie: str) -> float:
    margin = MARGIN_BY_CATEGORY.get(categorie.upper().strip(), DEFAULT_MARGIN)
    return round(tarif_reference * (1 + margin), 3)
```

This same constant (`MARGIN_BY_CATEGORY`) must live in `lib/constants.ts` for the dashboard and in `agent/config.py` for the agent. **One source of truth per language.**

---

## 7. Agent Behavior — Exact Specification

### First launch
1. Show a small GUI dialog (tkinter): "Entrez votre clé de licence"
2. POST `/api/activate` with `{ license_key, machine_id }` where `machine_id = str(uuid.uuid4())` generated once
3. On success: save `config.json` to the same directory as the `.exe`
4. Download SQLite from the URL returned by activate
5. Close dialog, start silently in system tray

### Every subsequent launch
1. Read `config.json` (if missing → go to first launch flow)
2. GET `/api/db-version` → compare with local version in `config.json`
3. If newer → download new SQLite silently
4. Start keyboard hook
5. Show tray icon: green dot + "PharmTrack actif"

### Keyboard hook logic
```
Maintain a string buffer
For every keypress:
  - If key is alphanumeric or dash → append to buffer
  - If key is ENTER (barcode readers send Enter after scan) → store buffer as last_barcode, clear buffer
  - If key is F10 → trigger sale event with last_barcode
  - If key is ESCAPE → clear buffer

On sale event:
  - If last_barcode is empty → ignore
  - Lookup last_barcode in local SQLite
  - If found → POST /api/transaction
  - If not found → log to local error.log, do NOT crash
  - Clear last_barcode after attempt
```

### config.json structure
```json
{
  "license_key": "uuid",
  "machine_id": "uuid",
  "pharmacy_id": "uuid",
  "register_id": "uuid",
  "db_version": 3,
  "db_path": "drugs.sqlite",
  "api_base_url": "https://pharmatrack-five.vercel.app"
}
```

---

## 8. API Routes — Exact Contracts

### POST `/api/activate`
**Called by:** agent on first launch

Request:
```json
{ "license_key": "uuid", "machine_id": "uuid" }
```
Response (200):
```json
{
  "pharmacy_id": "uuid",
  "register_id": "uuid",
  "db_version": 3,
  "db_url": "https://...supabase.../drugs_v3.sqlite"
}
```
Response (403): `{ "error": "Licence invalide" }`

### POST `/api/transaction`
**Called by:** agent on every F10 sale

Request:
```json
{
  "license_key": "uuid",
  "machine_id": "uuid",
  "barcode": "1234567",
  "drug_name": "DOLIPRANE 1000MG",
  "selling_price": 3.450
}
```
Response (201): `{ "transaction_id": "uuid" }`
Response (403): `{ "error": "Non autorisé" }`

### GET `/api/db-version`
**Called by:** agent on every launch

Query params: `?license_key=uuid`

Response (200):
```json
{ "version": 4, "db_url": "https://...supabase.../drugs_v4.sqlite" }
```

---

## 9. Coding Conventions

- **Language:** TypeScript for all Next.js code. Python 3.11 for the agent and scripts.
- **Naming:** `camelCase` for TS variables/functions, `PascalCase` for components and types, `snake_case` for Python and SQL columns.
- **Error handling:** Never swallow errors silently. Always log. In API routes, return structured JSON errors with appropriate HTTP status codes.
- **Secrets:** All secrets via environment variables. Never hardcode. Never commit `.env.local`.
- **Comments:** Write comments in **English**. UI text and user-facing strings in **French**.
- **No over-engineering:** Do not add abstractions, layers, or patterns that aren't explicitly needed for the current phase. Build what is specified, nothing more.
- **Supabase clients:** Use the correct client for context — `client.ts` in browser components, `server.ts` in Server Components and API routes, `admin.ts` only for admin operations that require service role.

---

## 10. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only, never expose to browser

# App
NEXT_PUBLIC_APP_URL=             # e.g. https://pharmatrack-five.vercel.app 

# Agent (embedded in config.json, not .env)
# api_base_url is stored in config.json
```

---

## 11. Phase Plan

Each phase is a separate Claude Code session. Complete one phase fully before starting the next.

| Phase | Scope | Status |
|---|---|---|
| **1** | Supabase schema (`schema.sql`) + `scripts/import_drugs.py` (.xlsx → Supabase + SQLite export) | ✅ |
| **2** | Next.js project scaffold + Supabase auth + `/login` page + layout + route protection | ⬜ Not started |
| **3** | API routes: `/api/activate`, `/api/transaction`, `/api/db-version` | ⬜ Not started |
| **4** | Dashboard UI: `SalesFeed`, `RegisterCard`, `TotalsBar` + Supabase Realtime integration | ⬜ Not started |
| **5** | Windows agent: keyboard hook + SQLite lookup + API calls + system tray | ⬜ Not started |
| **6** | PyInstaller packaging → single `.exe` with assets | ⬜ Not started |
| **7** | Admin panel: create pharmacy, generate license key, upload new drug DB | ⬜ Not started |

> **Rule:** When completing a phase, update the Status column from ⬜ to ✅.

---

## 12. Hard Constraints

- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or to the agent
- **Never** skip RLS policies — every table must have row-level security enabled
- **Never** store raw prices from the barcode event — always look up from the trusted local SQLite
- **Never** let the agent crash on a failed API call — log and continue
- **Never** use `any` type in TypeScript unless absolutely unavoidable (and add a comment explaining why)
- **Never** build Phase N+1 features while working on Phase N
- **Never** modify `supabase/schema.sql` without also writing a migration comment explaining what changed and why