"""Read/write the agent's config.json (lives next to the .exe)."""

import json
import os
import sys
import tempfile
from pathlib import Path

CONFIG_FILENAME = "config.json"


def get_exe_dir() -> Path:
    # When frozen by PyInstaller, config.json and the SQLite DB sit next to the
    # executable. Otherwise fall back to this source file's directory.
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def _config_path() -> Path:
    return get_exe_dir() / CONFIG_FILENAME


def load_config() -> dict | None:
    # Returns the parsed config, or None if missing or malformed.
    path = _config_path()
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def save_config(data: dict) -> None:
    # Atomic write: serialise to a temp file in the same directory, then replace.
    path = _config_path()
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
        os.replace(tmp_name, path)
    except Exception:
        # Best-effort cleanup of the temp file before re-raising.
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
