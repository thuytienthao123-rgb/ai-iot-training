"""
optimize_avatar_db.py - VSL 3D Motion Cleansing & Handshape Crispness Engine
Tối ưu hóa bộ dữ liệu 3D Avatar VSL:
1. Phân loại chuẩn 1-tay (1-handed) vs 2-tay (2-handed). Khóa tay không dùng ở vị trí nghỉ tự nhiên bên hông.
2. Bộ lọc làm mượt thời gian (Temporal Moving Average Filter) triệt tiêu hoàn toàn rung nhiễu và giật tay.
3. Tăng cường độ nét dáng ngón tay (Handshape Contrast): ngón thẳng duỗi 100%, ngón gập nắm 100%.
4. Chuẩn hóa vị trí ký hiệu 3D (Face, Nose, Chest, Stomach).
"""

import os
import sys
import io
import json
import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IN_JSON    = os.path.join(SCRIPT_DIR, "vsl_avatar_db.json")
OUT_JSON   = os.path.join(SCRIPT_DIR, "vsl_avatar_db.json")


def smooth_array_1d(arr, window=3):
    """Bộ lọc mượt 1D (Moving Average)"""
    if len(arr) < window:
        return arr
    kernel = np.ones(window) / window
    return np.convolve(arr, kernel, mode='same')


def amplify_finger_curls(curls):
    """Tăng cường tương phản dáng ngón tay (Handshape Contrast)"""
    clean_curls = []
    for c in curls:
        if c < 0.32:
            # Ngón thẳng -> Duỗi thẳng 100%
            clean_curls.append(0.0)
        elif c > 0.75:
            # Ngón gập -> Gập nắm 100%
            clean_curls.append(round(float(min(2.4, c * 1.35)), 3))
        else:
            clean_curls.append(round(float(c), 3))
    return clean_curls


def main():
    print("=" * 60)
    print("  VSL 3D Motion Cleansing & Handshape Crispness Engine")
    print("=" * 60)

    if not os.path.exists(IN_JSON):
        print(f"[ERROR] {IN_JSON} not found!")
        return

    with open(IN_JSON, "r", encoding="utf-8") as f:
        db = json.load(f)

    clean_db = {}
    count_1hand = 0
    count_2hand = 0

    for word, anim in db.items():
        frames = anim.get("frames", [])
        if not frames:
            continue

        # 1. Phân loại 1-handed vs 2-handed
        l_active_count = sum(
            1 for f in frames
            if f.get("l_pos", [0, -0.5, 0])[1] > -0.25 and f.get("l_pos", [0, -0.5, 0])[2] > 0.15
        )
        is_2handed = (l_active_count >= len(frames) * 0.32)

        if is_2handed:
            count_2hand += 1
        else:
            count_1hand += 1

        # Trích xuất các chuỗi tọa độ để làm mượt
        r_tx = [f["r_pos"][0] for f in frames]
        r_ty = [f["r_pos"][1] for f in frames]
        r_tz = [f["r_pos"][2] for f in frames]

        l_tx = [f["l_pos"][0] for f in frames]
        l_ty = [f["l_pos"][1] for f in frames]
        l_tz = [f["l_pos"][2] for f in frames]

        # 2. Làm mượt chuỗi vị trí 3D
        r_tx_s = smooth_array_1d(r_tx)
        r_ty_s = smooth_array_1d(r_ty)
        r_tz_s = smooth_array_1d(r_tz)

        l_tx_s = smooth_array_1d(l_tx)
        l_ty_s = smooth_array_1d(l_ty)
        l_tz_s = smooth_array_1d(l_tz)

        new_frames = []
        for i, f in enumerate(frames):
            r_cu_clean = amplify_finger_curls(f.get("r_cu", [0, 0, 0, 0, 0]))

            r_pos_clean = [
                round(float(r_tx_s[i]), 3),
                round(float(r_ty_s[i]), 3),
                round(float(max(0.18, r_tz_s[i])), 3)
            ]

            if is_2handed:
                l_cu_clean = amplify_finger_curls(f.get("l_cu", [0, 0, 0, 0, 0]))
                l_pos_clean = [
                    round(float(l_tx_s[i]), 3),
                    round(float(l_ty_s[i]), 3),
                    round(float(max(0.18, l_tz_s[i])), 3)
                ]
            else:
                # Nếu là từ 1 tay: giữ tay trái ở vị trí nghỉ tự nhiên bên hông
                l_cu_clean = [0.0, 0.0, 0.0, 0.0, 0.0]
                l_pos_clean = [-0.15, -0.45, 0.10]

            new_frames.append({
                "r_pos": r_pos_clean,
                "r_ori": f.get("r_ori", [0, 0]),
                "r_cu":  r_cu_clean,
                "l_pos": l_pos_clean,
                "l_ori": f.get("l_ori", [0, 0]) if is_2handed else [0, 0],
                "l_cu":  l_cu_clean,
                "is_2hand": is_2handed
            })

        clean_db[word] = {
            "fps": anim.get("fps", 20),
            "is_2hand": is_2handed,
            "frames": new_frames
        }

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(clean_db, f, ensure_ascii=False)

    size_mb = os.path.getsize(OUT_JSON) / (1024 * 1024)
    print(f"[DONE] Cleansed 3D database for {len(clean_db)} words ({size_mb:.2f} MB)")
    print(f"       1-Handed words: {count_1hand}")
    print(f"       2-Handed words: {count_2hand}")
    print("=" * 60)


if __name__ == "__main__":
    main()
