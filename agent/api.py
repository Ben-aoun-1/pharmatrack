"""HTTP calls to the PharmTrack backend.

Every failure is logged with a timestamp to stdout (PyInstaller redirects this
to error.log). Only `activate` may raise — the rest never raise.
"""

from datetime import datetime
from pathlib import Path

import requests

TIMEOUT_SECONDS = 10


def _log(message: str) -> None:
    print(f"[{datetime.now().isoformat()}] {message}")


def activate(license_key: str, machine_id: str, api_base_url: str) -> dict:
    # POST /api/activate. Returns parsed JSON on 200; raises RuntimeError with a
    # French message otherwise (shown in the activation dialog).
    url = f"{api_base_url.rstrip('/')}/api/activate"
    try:
        response = requests.post(
            url,
            json={"license_key": license_key, "machine_id": machine_id},
            timeout=TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        _log(f"Activation: erreur réseau: {exc}")
        raise RuntimeError("Erreur de connexion au serveur.") from exc

    if response.status_code == 200:
        return response.json()

    # Surface the server's French error message if present.
    message = None
    try:
        message = response.json().get("error")
    except ValueError:
        message = None
    _log(f"Activation refusée (HTTP {response.status_code}): {message}")
    raise RuntimeError(
        message or "Échec de l'activation. Vérifiez la clé de licence."
    )


def post_transaction(
    config: dict, barcode: str, drug_name: str, selling_price: float
) -> bool:
    # POST /api/transaction. True on 201; logs and returns False on any failure.
    url = f"{config['api_base_url'].rstrip('/')}/api/transaction"
    payload = {
        "license_key": config.get("license_key"),
        "machine_id": config.get("machine_id"),
        "barcode": barcode,
        "drug_name": drug_name,
        "selling_price": selling_price,
    }
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT_SECONDS)
        if response.status_code == 201:
            return True
        _log(f"Transaction refusée (HTTP {response.status_code}) pour {barcode}")
        return False
    except Exception as exc:  # noqa: BLE001 — must never raise
        _log(f"Transaction: erreur pour {barcode}: {exc}")
        return False


def get_db_version(config: dict) -> dict | None:
    # GET /api/db-version?license_key=... Returns {version, db_url} or None.
    url = f"{config['api_base_url'].rstrip('/')}/api/db-version"
    try:
        response = requests.get(
            url,
            params={"license_key": config.get("license_key")},
            timeout=TIMEOUT_SECONDS,
        )
        if response.status_code == 200:
            data = response.json()
            return {"version": data.get("version"), "db_url": data.get("db_url")}
        _log(f"db-version: réponse inattendue (HTTP {response.status_code})")
        return None
    except Exception as exc:  # noqa: BLE001 — must never raise
        _log(f"db-version: erreur: {exc}")
        return None


def download_file(url: str, dest_path: Path) -> bool:
    # Streams a file to dest_path. True on success; logs and returns False else.
    try:
        with requests.get(url, stream=True, timeout=TIMEOUT_SECONDS) as response:
            if response.status_code != 200:
                _log(f"Téléchargement échoué (HTTP {response.status_code}): {url}")
                return False
            dest = Path(dest_path)
            with dest.open("wb") as fh:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        fh.write(chunk)
        return True
    except Exception as exc:  # noqa: BLE001 — must never raise
        _log(f"Téléchargement: erreur pour {url}: {exc}")
        return False
