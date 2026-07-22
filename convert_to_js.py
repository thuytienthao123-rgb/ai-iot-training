"""
convert_to_js.py
Chuyển đổi jarvis.glb và vsl_avatar_db.json sang các file JavaScript (jarvis_model.js & vsl_avatar_db.js)
để ứng dụng index.html có thể nạp trực tiếp 100% qua file:// mà KHÔNG BỊ LỖI CORS của trình duyệt!
"""

import os
import sys
import io
import json
import base64

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GLB_PATH   = os.path.join(os.path.dirname(SCRIPT_DIR), "jarvis.glb")
JSON_PATH  = os.path.join(SCRIPT_DIR, "vsl_avatar_db.json")

OUT_JARVIS_JS = os.path.join(SCRIPT_DIR, "jarvis_model.js")
OUT_DB_JS     = os.path.join(SCRIPT_DIR, "vsl_avatar_db.js")


def convert_glb():
    print("[INFO] Converting jarvis.glb to Base64 JS...")
    with open(GLB_PATH, "rb") as f:
        data = f.read()

    b64 = base64.b64encode(data).decode("utf-8")

    with open(OUT_JARVIS_JS, "w", encoding="utf-8") as f:
        f.write("window.JARVIS_BASE64 = \"data:application/octet-stream;base64," + b64 + "\";\n")

    size_mb = os.path.getsize(OUT_JARVIS_JS) / (1024 * 1024)
    print(f"[DONE] Saved {OUT_JARVIS_JS} ({size_mb:.2f} MB)")


def convert_db():
    print("[INFO] Converting vsl_avatar_db.json to JS...")
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    db_str = json.dumps(db, ensure_ascii=False)

    with open(OUT_DB_JS, "w", encoding="utf-8") as f:
        f.write("window.DB_DATA = " + db_str + ";\n")

    size_mb = os.path.getsize(OUT_DB_JS) / (1024 * 1024)
    print(f"[DONE] Saved {OUT_DB_JS} ({size_mb:.2f} MB)")


def main():
    print("=" * 60)
    print("  VSL JS Asset Converter for 100% File:// Offline Compatibility")
    print("=" * 60)
    convert_glb()
    convert_db()
    print("=" * 60)


if __name__ == "__main__":
    main()
