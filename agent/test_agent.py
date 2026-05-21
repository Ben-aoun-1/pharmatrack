"""
PharmTrack Agent — Smoke Test
Run with: python test_agent.py
Tests core logic without starting the tray or keyboard hook.
"""
import sys
import os
import tempfile
import sqlite3
from pathlib import Path

print("=== PharmTrack Agent Smoke Test ===\n")
errors = []

# Test 1: imports
print("[1/5] Testing imports...")
try:
    import requests
    import pynput
    import pystray
    from PIL import Image, ImageDraw
    print("      ✅ All dependencies importable")
except ImportError as e:
    errors.append(f"Import failed: {e}")
    print(f"      ❌ {e}")

# Test 2: config
print("[2/5] Testing config read/write...")
try:
    from config import load_config, save_config, get_exe_dir
    with tempfile.TemporaryDirectory() as tmp:
        test_config = {
            "license_key": "test-key",
            "machine_id": "test-machine",
            "pharmacy_id": "test-pharmacy",
            "register_id": "test-register",
            "db_version": 1,
            "db_path": "drugs.sqlite",
            "api_base_url": "https://pharmatrack-five.vercel.app"
        }
        # temporarily override exe dir
        import config as cfg_module
        orig = cfg_module.get_exe_dir
        cfg_module.get_exe_dir = lambda: Path(tmp)
        save_config(test_config)
        loaded = load_config()
        cfg_module.get_exe_dir = orig
        assert loaded["license_key"] == "test-key"
        print("      ✅ Config read/write OK")
except Exception as e:
    errors.append(f"Config test failed: {e}")
    print(f"      ❌ {e}")

# Test 3: SQLite lookup
print("[3/5] Testing SQLite drug lookup...")
try:
    from db import lookup_barcode
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "drugs.sqlite"
        conn = sqlite3.connect(db_path)
        conn.execute("""CREATE TABLE drugs (
            code_pct TEXT PRIMARY KEY,
            nom_commercial TEXT,
            selling_price REAL,
            tarif_reference REAL,
            categorie TEXT,
            ap TEXT
        )""")
        conn.execute("INSERT INTO drugs VALUES ('1234567','DOLIPRANE 1000MG',3.450,2.700,'REMBOURSABLE','')")
        conn.commit()
        conn.close()
        result = lookup_barcode("1234567", db_path)
        assert result is not None
        assert result["nom_commercial"] == "DOLIPRANE 1000MG"
        assert abs(result["selling_price"] - 3.450) < 0.001
        none_result = lookup_barcode("9999999", db_path)
        assert none_result is None
        print("      ✅ SQLite lookup OK")
except Exception as e:
    errors.append(f"DB test failed: {e}")
    print(f"      ❌ {e}")

# Test 4: PIL icon generation
print("[4/5] Testing tray icon generation...")
try:
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (64, 64), color=(0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([4, 4, 60, 60], fill=(34, 197, 94), outline=(255, 255, 255), width=3)
    assert img.size == (64, 64)
    print("      ✅ PIL icon generation OK")
except Exception as e:
    errors.append(f"PIL test failed: {e}")
    print(f"      ❌ {e}")

# Test 5: keyboard hook buffer logic
print("[5/5] Testing keyboard hook buffer logic...")
try:
    from hooks import KeyboardHook
    sales = []
    hook = KeyboardHook(on_sale=lambda b: sales.append(b))
    # simulate barcode scan: set buffer directly
    hook._lock.acquire()
    hook._buffer = "1234567"
    hook._last_scan = "1234567"
    hook._lock.release()
    # simulate F10
    from pynput.keyboard import Key
    hook._on_press(Key.f10)
    assert sales == ["1234567"], f"Expected ['1234567'], got {sales}"
    print("      ✅ Keyboard hook logic OK")
except Exception as e:
    errors.append(f"Hook test failed: {e}")
    print(f"      ❌ {e}")

# Summary
print(f"\n{'='*40}")
if errors:
    print(f"❌ {len(errors)} test(s) failed:")
    for e in errors:
        print(f"   • {e}")
    sys.exit(1)
else:
    print("✅ All tests passed — ready to build")
    sys.exit(0)
