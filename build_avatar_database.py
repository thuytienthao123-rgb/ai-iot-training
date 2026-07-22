"""
build_avatar_database.py - High Fidelity VSL 3D Avatar Motion Generator
Trích xuất dữ liệu chuyển động 3D chuẩn giải phẫu cho 550 từ vựng VSL.

Các tính năng chính:
1. Trích xuất chính xác 5 độ gập ngón tay (Thumb, Index, Middle, Ring, Pinky) từ khớp PIP/DIP.
2. Tách lọc khoảng thời gian thực hiện ký hiệu thực tế (Active Signing Phase) bằng cách loại bỏ các khung hình thả tay nghỉ ở đầu/cuối video.
3. Tính toán vị trí bàn tay 3D (tx, ty, tz) và hướng cổ tay (hp, hy, hr) để điều khiển động học xương 3D Avatar (jarvis.glb).
"""

import os
import sys
import io
import json
import pandas as pd
import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "dataset", "Dataset")
LABEL_CSV    = os.path.join(DATASET_PATH, "Labels", "label.csv")
FEATURES_DIR = os.path.join(DATASET_PATH, "Features")
ENC_PATH     = os.path.join(SCRIPT_DIR, "models", "label_encoder.json")
OUT_JSON     = os.path.join(SCRIPT_DIR, "vsl_avatar_db.json")

# Tọa độ chuẩn hóa khung hình MediaPipe:
# Center = 0.43, Face = 0.20, Chest = 0.55, Waist = 0.85
X_CENTER = 0.43
Y_CHEST  = 0.55


def compute_joint_angle(p0, p1, p2):
    """Tính góc gập ngón tay tại khớp giữa PIP (0.0 rad = thẳng, ~2.5 rad = gập nắm)."""
    v1 = p1 - p0
    v2 = p2 - p1
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 0.0
    dot = np.clip(np.dot(v1 / n1, v2 / n2), -1.0, 1.0)
    return round(float(np.arccos(dot)), 3)


def process_hand_landmarks(lm):
    """
    lm: (21, 3) MediaPipe hand landmarks
    """
    wrist = lm[0]
    wx, wy, wz = float(wrist[0]), float(wrist[1]), float(wrist[2])

    # 1. Tọa độ mục tiêu 3D của cổ tay trong không gian Avatar (tính bằng mét từ vai)
    # tx: sang phải (+)/trái (-), ty: lên trên (+)/xuống (-), tz: ra trước (+)/sau (-)
    tx = round(float((X_CENTER - wx) * 0.85), 3)
    ty = round(float((Y_CHEST - wy) * 0.85), 3)
    tz = round(float(0.32 + (-wz) * 1.8), 3)

    # 2. Hướng cổ tay (Wrist Orientation) từ ngón giữa và lòng bàn tay
    mid_mcp = lm[9]
    v_hand = mid_mcp - wrist
    v_norm = np.linalg.norm(v_hand)
    if v_norm > 1e-6:
        v_hand = v_hand / v_norm

    # Pitch ngón tay chỉ lên hay xuống
    hp = round(float(-v_hand[1] * 0.9), 3)
    # Yaw nghiêng ngón tay sang trái/phải
    hy = round(float(v_hand[0] * 0.9), 3)

    # 3. Tính độ gập chính xác cho 5 ngón tay (Thumb, Index, Middle, Ring, Pinky)
    # Thumb: 1-2-4
    c_thumb  = compute_joint_angle(lm[1], lm[2], lm[4])
    # Index: 5-6-8 (mcp=5, pip=6, tip=8)
    c_index  = compute_joint_angle(lm[5], lm[6], lm[8])
    # Middle: 9-10-12
    c_middle = compute_joint_angle(lm[9], lm[10], lm[12])
    # Ring: 13-14-16
    c_ring   = compute_joint_angle(lm[13], lm[14], lm[16])
    # Pinky: 17-18-20
    c_pinky  = compute_joint_angle(lm[17], lm[18], lm[20])

    curls = [c_thumb, c_index, c_middle, c_ring, c_pinky]

    return {
        "tx": tx, "ty": ty, "tz": tz,
        "hp": hp, "hy": hy,
        "cu": curls
    }


def process_npy_file(npy_path):
    arr = np.load(npy_path, allow_pickle=True).astype(float)

    if arr.ndim == 2:
        n = arr.shape[0]
        arr = arr.reshape(n, -1, 3)

    if arr.ndim != 3 or arr.shape[1] < 21 or arr.shape[0] < 3:
        return None

    # Lọc giai đoạn thực hiện ký hiệu thực tế (Active Signing Window):
    # Loại bỏ các khung hình tay ở thấp hơn thắt lưng (wy > 0.85) ở đầu/cuối video
    active_indices = [i for i, frame in enumerate(arr) if frame[0, 1] < 0.83]

    if len(active_indices) >= 5:
        active_arr = arr[active_indices]
    else:
        active_arr = arr

    # Lấy mẫu 28 khung hình cho mỗi cử chỉ
    n_frames = len(active_arr)
    step = max(1, n_frames // 28)
    indices = list(range(0, n_frames, step))[:28]

    frames = [process_hand_landmarks(active_arr[i]) for i in indices]

    return {
        "fps": 20,
        "frames": frames
    }


def main():
    print("=" * 60)
    print("  VSL High-Fidelity 3D Avatar Database Builder")
    print("=" * 60)

    df = pd.read_csv(LABEL_CSV)
    with open(ENC_PATH, "r", encoding="utf-8") as f:
        enc = json.load(f)
    trained_words = sorted(set(enc.values()))
    print(f"[INFO] Total trained labels: {len(trained_words)}")

    label_to_npy = {}
    for _, row in df.iterrows():
        vname = str(row["VIDEO"]).strip()
        label = str(row["LABEL"]).strip()
        stem  = os.path.splitext(vname)[0]
        npy_p = os.path.join(FEATURES_DIR, stem + ".npy")
        if os.path.exists(npy_p):
            label_to_npy.setdefault(label, []).append(npy_p)

    database = {}
    processed = 0

    for label in trained_words:
        npy_list = label_to_npy.get(label, [])
        if not npy_list:
            continue

        best_npy = max(npy_list, key=os.path.getsize)
        anim_data = process_npy_file(best_npy)

        if anim_data:
            database[label] = anim_data
            processed += 1

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(database, f, ensure_ascii=False)

    size_mb = os.path.getsize(OUT_JSON) / (1024 * 1024)
    print("\n" + "=" * 60)
    print(f"[DONE] Generated 3D sign animations for {processed}/{len(trained_words)} words")
    print(f"       Database saved -> {OUT_JSON}")
    print(f"       File size      : {size_mb:.2f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
