"""Global keyboard hook that detects barcode scans followed by F10.

USB-HID barcode readers behave like a keyboard: they "type" the barcode as a
fast burst of characters and then send Enter. The cashier confirms the sale by
pressing F10. We buffer keystrokes, accept a plausible barcode on Enter, and
fire the sale callback on F10.
"""

import threading
import time
from datetime import datetime
from typing import Callable

from pynput import keyboard

# A buffer is accepted as a scan only if it looks like a barcode.
MIN_SCAN_LEN = 4
MAX_SCAN_LEN = 20
# If two characters are further apart than this, the earlier buffer was human
# typing (or a stale burst) and is discarded before appending the new char.
INTERKEY_RESET_SECONDS = 1.0


def _log(message: str) -> None:
    print(f"[{datetime.now().isoformat()}] {message}")


class KeyboardHook:
    def __init__(self, on_sale: Callable[[str], None]) -> None:
        self._on_sale = on_sale
        self._buffer = ""
        self._last_scan = ""
        self._last_key_time = 0.0
        self._lock = threading.Lock()
        self._listener = None

    def start(self) -> None:
        # Non-blocking global listener (runs on its own thread).
        self._listener = keyboard.Listener(on_press=self._on_press)
        self._listener.start()

    def stop(self) -> None:
        if self._listener is not None:
            self._listener.stop()
            self._listener = None

    def _on_press(self, key) -> None:
        # The listener thread must never crash — swallow and log everything.
        try:
            if key == keyboard.Key.f10:
                self._handle_f10()
                return
            if key == keyboard.Key.enter:
                self._handle_enter()
                return
            # Printable character keys expose a `.char`; special keys do not.
            char = getattr(key, "char", None)
            if char is not None and char.isprintable():
                self._handle_char(char)
        except Exception as exc:  # noqa: BLE001 — listener must never crash
            _log(f"Erreur dans le hook clavier: {exc}")

    def _handle_char(self, char: str) -> None:
        now = time.monotonic()
        with self._lock:
            # Large gap → previous characters were not part of this burst.
            if now - self._last_key_time > INTERKEY_RESET_SECONDS:
                self._buffer = ""
            self._buffer += char
            self._last_key_time = now

    def _handle_enter(self) -> None:
        with self._lock:
            buffer = self._buffer
            self._buffer = ""
            if MIN_SCAN_LEN <= len(buffer) <= MAX_SCAN_LEN and buffer.isalnum():
                self._last_scan = buffer
            # Otherwise it was human typing — already discarded.

    def _handle_f10(self) -> None:
        with self._lock:
            scan = self._last_scan
            self._last_scan = ""
        if not scan:
            return
        # Dispatch on a background thread so a slow network call never blocks the
        # listener (which could drop subsequent scans).
        threading.Thread(
            target=self._safe_on_sale, args=(scan,), daemon=True
        ).start()

    def _safe_on_sale(self, scan: str) -> None:
        try:
            self._on_sale(scan)
        except Exception as exc:  # noqa: BLE001 — callback must never crash us
            _log(f"Erreur dans le callback de vente: {exc}")
