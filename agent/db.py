"""Local SQLite drug lookup. Opens and closes a connection per call."""

import sqlite3
from datetime import datetime
from pathlib import Path

from config import get_exe_dir


def _log(message: str) -> None:
    print(f"[{datetime.now().isoformat()}] {message}")


def _resolve(db_path) -> Path:
    # Relative paths (e.g. "drugs.sqlite") resolve next to the executable.
    path = Path(db_path)
    return path if path.is_absolute() else get_exe_dir() / path


def lookup_barcode(barcode: str, db_path) -> dict | None:
    # Returns {nom_commercial, selling_price} or None if not found / on error.
    path = _resolve(db_path)
    if not path.exists():
        _log(f"Base SQLite introuvable: {path}")
        return None

    conn = None
    try:
        conn = sqlite3.connect(str(path))
        row = conn.execute(
            "SELECT nom_commercial, selling_price FROM drugs WHERE code_pct = ?",
            (barcode,),
        ).fetchone()
        if row is None:
            return None
        return {"nom_commercial": row[0], "selling_price": row[1]}
    except Exception as exc:  # noqa: BLE001 — must never raise
        _log(f"Erreur de lecture SQLite pour {barcode}: {exc}")
        return None
    finally:
        if conn is not None:
            conn.close()
