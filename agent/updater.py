"""Check the server's drug DB version and download a newer one if needed."""

import os
from datetime import datetime
from pathlib import Path

import api
from config import get_exe_dir, save_config


def _log(message: str) -> None:
    print(f"[{datetime.now().isoformat()}] {message}")


def _resolve(db_path) -> Path:
    path = Path(db_path)
    return path if path.is_absolute() else get_exe_dir() / path


def check_and_update(config: dict) -> dict:
    # Returns the (possibly updated) config. Never raises.
    try:
        info = api.get_db_version(config)
        if info is None:
            return config

        version = info.get("version") or 0
        db_url = info.get("db_url")

        # No DB uploaded yet (Phase 7 territory) — nothing to do.
        if not db_url or version == 0:
            return config

        current = config.get("db_version", 0) or 0
        if version <= current:
            return config

        dest = _resolve(config.get("db_path", "drugs.sqlite"))
        tmp = dest.with_suffix(dest.suffix + ".tmp")

        _log(f"Mise à jour de la base: v{current} -> v{version}")
        if not api.download_file(db_url, tmp):
            _log("Téléchargement échoué; conservation de la version actuelle.")
            return config

        os.replace(tmp, dest)
        config["db_version"] = version
        save_config(config)
        _log(f"Base mise à jour vers la version {version}.")
        return config
    except Exception as exc:  # noqa: BLE001 — must never raise
        _log(f"Erreur lors de la mise à jour de la base: {exc}")
        return config
