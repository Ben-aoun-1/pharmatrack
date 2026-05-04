"""
PharmTrack — apply the database schema to Supabase.

Reads supabase/schema.sql, connects to the project's Postgres instance, runs
the SQL, then validates by listing the public tables that now exist.

Connection: Supabase DDL must run against Postgres directly (the REST API and
the service-role JWT cannot execute arbitrary DDL). This script looks for a
Postgres connection in the following order, reading from .env.local:

    1. SUPABASE_DB_URL / DATABASE_URL  — a full postgres://... connection string
    2. SUPABASE_DB_PASSWORD            — the database password; host is derived
                                          from NEXT_PUBLIC_SUPABASE_URL
    3. SUPABASE_SERVICE_ROLE_KEY       — last-resort attempt as the postgres
                                          password (works only if it happens to
                                          match; normally it will NOT)

Run from the project root:
    python scripts/run_schema.py
"""

import os
import sys
from urllib.parse import urlparse

import psycopg2
from dotenv import load_dotenv

EXPECTED_TABLES = ["pharmacies", "registers", "transactions",
                   "drug_db_versions", "drugs"]

# schema.sql lives one level up from this script, under supabase/.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
SCHEMA_PATH = os.path.join(PROJECT_ROOT, "supabase", "schema.sql")
ENV_PATH = os.path.join(PROJECT_ROOT, ".env.local")


def project_ref(supabase_url: str) -> str:
    """Extract the project ref (subdomain) from the Supabase URL."""
    host = urlparse(supabase_url).hostname or ""
    return host.split(".")[0]


def build_connection():
    """Open a psycopg2 connection using the best available credentials."""
    load_dotenv(ENV_PATH)

    # 1. Full connection string, if provided.
    dsn = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        print("Connecting via SUPABASE_DB_URL/DATABASE_URL ...")
        return psycopg2.connect(dsn)

    supabase_url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
                    or os.environ.get("SUPABASE_URL"))
    if not supabase_url:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) is not set.",
              file=sys.stderr)
        sys.exit(1)

    ref = project_ref(supabase_url)
    host = f"db.{ref}.supabase.co"

    # 2. Explicit DB password, or 3. service-role key as a last resort.
    password = os.environ.get("SUPABASE_DB_PASSWORD")
    if password:
        print(f"Connecting to {host} with SUPABASE_DB_PASSWORD ...")
    else:
        password = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not password:
            print("ERROR: no database credentials found. Set SUPABASE_DB_URL, "
                  "SUPABASE_DB_PASSWORD, or SUPABASE_SERVICE_ROLE_KEY in "
                  ".env.local.", file=sys.stderr)
            sys.exit(1)
        print(f"Connecting to {host} with SUPABASE_SERVICE_ROLE_KEY "
              "(fallback) ...")

    return psycopg2.connect(
        host=host,
        port=5432,
        dbname="postgres",
        user="postgres",
        password=password,
        connect_timeout=15,
        sslmode="require",
    )


def main() -> None:
    if not os.path.exists(SCHEMA_PATH):
        print(f"ERROR: schema not found at {SCHEMA_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    try:
        conn = build_connection()
    except Exception as exc:  # noqa: BLE001 — surface the real connection error
        print(f"Connection failed: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            # psycopg2 runs the whole multi-statement DDL as a simple query.
            cur.execute(schema_sql)
            print("Schema applied successfully")

            # Validate: list the public tables that now exist.
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
                """
            )
            tables = [row[0] for row in cur.fetchall()]
            print(f"Tables in public schema ({len(tables)}): "
                  f"{', '.join(tables)}")

            missing = [t for t in EXPECTED_TABLES if t not in tables]
            if missing:
                print(f"⚠ Expected table(s) missing: {', '.join(missing)}",
                      file=sys.stderr)
            else:
                print("✓ All expected tables present: "
                      f"{', '.join(EXPECTED_TABLES)}")
    except Exception as exc:  # noqa: BLE001 — report the SQL/validation error
        print(f"ERROR while applying schema: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
