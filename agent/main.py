"""PharmTrack agent entry point.

Flow: load config (or run first-launch activation) → register Windows auto-start
→ update the local drug DB → start the keyboard hook → run the tray icon.
"""

import sys
import tkinter as tk
import uuid
import winreg
from datetime import datetime

import api
import db
import tray
import updater
from config import get_exe_dir, load_config, save_config
from hooks import KeyboardHook

API_BASE_URL = "https://pharmatrack-five.vercel.app"


def _log(message: str) -> None:
    print(f"[{datetime.now().isoformat()}] {message}")


def register_autostart() -> None:
    # Launch the .exe on Windows login. Best-effort: log and continue on failure.
    try:
        exe_path = str(get_exe_dir() / "PharmTrack.exe")
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            0,
            winreg.KEY_SET_VALUE,
        )
        winreg.SetValueEx(key, "PharmTrack", 0, winreg.REG_SZ, exe_path)
        winreg.CloseKey(key)
    except Exception as exc:  # noqa: BLE001 — never crash on auto-start
        _log(f"Échec de l'enregistrement du démarrage automatique: {exc}")


def first_launch_setup() -> dict:
    # Tkinter activation dialog, shown only when config.json is absent.
    result: dict = {"config": None}

    window = tk.Tk()
    window.title("PharmTrack — Activation")
    window.resizable(False, False)

    tk.Label(window, text="Clé de licence").grid(
        row=0, column=0, padx=12, pady=(12, 4), sticky="w"
    )
    entry = tk.Entry(window, width=40)
    entry.grid(row=1, column=0, padx=12, pady=4)

    error_label = tk.Label(
        window, text="", fg="red", wraplength=320, justify="left"
    )
    error_label.grid(row=3, column=0, padx=12, pady=(0, 8), sticky="w")

    def on_activate() -> None:
        license_key = entry.get().strip()
        if not license_key:
            error_label.config(text="Veuillez entrer une clé de licence.")
            return

        machine_id = str(uuid.uuid4())
        try:
            response = api.activate(license_key, machine_id, API_BASE_URL)
        except RuntimeError as exc:
            error_label.config(text=str(exc))
            return

        new_config = {
            "license_key": license_key,
            "machine_id": machine_id,
            "pharmacy_id": response.get("pharmacy_id"),
            "register_id": response.get("register_id"),
            "db_version": response.get("db_version", 0) or 0,
            "db_path": "drugs.sqlite",
            "api_base_url": API_BASE_URL,
        }
        try:
            save_config(new_config)
        except Exception as exc:  # noqa: BLE001
            error_label.config(
                text=f"Impossible d'enregistrer la configuration : {exc}"
            )
            return

        result["config"] = new_config
        window.destroy()

    tk.Button(window, text="Activer", command=on_activate).grid(
        row=2, column=0, padx=12, pady=4
    )

    def on_close() -> None:
        # Closed without activating → exit cleanly.
        window.destroy()
        sys.exit(0)

    window.protocol("WM_DELETE_WINDOW", on_close)
    window.mainloop()

    if result["config"] is None:
        sys.exit(0)
    return result["config"]


def main() -> None:
    config = load_config()
    if config is None:
        config = first_launch_setup()

    # Ensure the agent relaunches on login (covers first run and every launch).
    register_autostart()

    # Pull a newer drug DB if one is available.
    config = updater.check_and_update(config)

    def on_sale(barcode: str) -> None:
        result = db.lookup_barcode(barcode, config["db_path"])
        if result:
            drug_name = result["nom_commercial"]
            selling_price = result["selling_price"]
        else:
            drug_name = f"Inconnu ({barcode})"
            selling_price = 0.0
        success = api.post_transaction(config, barcode, drug_name, selling_price)
        if not success:
            print(f"[{datetime.now()}] Transaction échouée: {barcode}")

    hook = KeyboardHook(on_sale)
    hook.start()

    def on_quit() -> None:
        try:
            hook.stop()
        except Exception:  # noqa: BLE001
            pass
        icon.stop()

    icon = tray.create_tray_icon(on_quit)
    tray.run_tray(icon)


if __name__ == "__main__":
    main()
