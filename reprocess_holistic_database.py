"""
reprocess_holistic_database.py - High-Fidelity Multi-Hand 3D VSL Generator (Fast Optimized)
Trích xuất đầy đủ 3D Pose (Shoulder-Elbow-Wrist) + 2 Bàn tay (Right & Left Hands)
cho 550 từ vựng VSL bằng MediaPipe Holistic. Tối ưu hóa tốc độ xử lý gấp 4 lần.
"""

import os
import sys
import io
import json
import cv2
import pandas as pd
import numpy as np
from tqdm import tqdm
import mediapipe as mp

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(SCRIPT_DIR, "dataset", "Dataset")
LABEL_CSV    = os.path.join(DATASET_PATH, "Labels", "label.csv")
VIDEOS_DIR   = os.path.join(DATASET_PATH, "Videos")
ENC_PATH     = os.path.join(SCRIPT_DIR, "models", "label_encoder.json")
OUT_JSON     = os.path.join(SCRIPT_DIR, "vsl_avatar_db.json")


def compute_finger_curl(lm, b, m, t):
    """Tính góc gập ngón tay từ 3 điểm landmark (MCP, PIP, TIP)."""
    v1 = np.array(lm[m]) - np.array(lm[b])
    v2 = np.array(lm[t]) - np.array(lm[m])
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 0.0
    dot = np.clip(np.dot(v1 / n1, v2 / n2), -1.0, 1.0)
    return round(float(np.arccos(dot)), 3)


def get_hand_curls(hand_lms):
    if not hand_lms:
        return [0.0, 0.0, 0.0, 0.0, 0.0]
    c_thumb  = compute_finger_curl(hand_lms, 1, 2, 4)
    c_index  = compute_finger_curl(hand_lms, 5, 6, 8)
    c_middle = compute_finger_curl(hand_lms, 9, 10, 12)
    c_ring   = compute_finger_curl(hand_lms, 13, 14, 16)
    c_pinky  = compute_finger_curl(hand_lms, 17, 18, 20)
    return [c_thumb, c_index, c_middle, c_ring, c_pinky]


def get_wrist_orientation(hand_lms, is_right=True):
    if not hand_lms:
        return 0.0, 0.0
    wrist = np.array(hand_lms[0])
    mid_mcp = np.array(hand_lms[9])
    v_hand = mid_mcp - wrist
    n = np.linalg.norm(v_hand)
    if n > 1e-6:
        v_hand = v_hand / n
    hp = round(float(-v_hand[1] * 0.8), 3)
    hy = round(float(v_hand[0] * 0.8), 3)
    return hp, hy


def process_single_video(video_path, holistic_detector):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    raw_frames = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_idx += 1
        # Bỏ qua mỗi 2 khung hình để tăng tốc độ xử lý 2x
        if frame_idx % 2 != 0:
            continue

        # Resize nhẹ 480p để MediaPipe Holistic chạy cực nhanh trên CPU
        h, w = frame.shape[:2]
        if w > 640:
            frame = cv2.resize(frame, (640, int(h * 640 / w)))

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = holistic_detector.process(rgb)

        pose = [[lm.x, lm.y, lm.z] for lm in res.pose_landmarks.landmark] if res.pose_landmarks else None
        rh   = [[lm.x, lm.y, lm.z] for lm in res.right_hand_landmarks.landmark] if res.right_hand_landmarks else None
        lh   = [[lm.x, lm.y, lm.z] for lm in res.left_hand_landmarks.landmark] if res.left_hand_landmarks else None

        raw_frames.append({'pose': pose, 'rh': rh, 'lh': lh})

    cap.release()

    if not raw_frames:
        return None

    # Lọc bớt các frame tay ở vị trí nghỉ (thắt lưng) ở đầu và cuối video
    valid_frames = []
    for f in raw_frames:
        if f['pose'] is None:
            continue
        p = f['pose']
        # 12 = R_Shoulder, 16 = R_Wrist, 11 = L_Shoulder, 15 = L_Wrist
        rw_y, lw_y = p[16][1], p[15][1]
        rs_y, ls_y = p[12][1], p[11][1]

        if (rw_y - rs_y < 0.38) or (lw_y - ls_y < 0.38):
            valid_frames.append(f)

    if len(valid_frames) < 5:
        valid_frames = [f for f in raw_frames if f['pose'] is not None]

    if not valid_frames:
        return None

    # Nội suy tay bị thiếu
    last_rh = next((f['rh'] for f in valid_frames if f['rh'] is not None), None)
    last_lh = next((f['lh'] for f in valid_frames if f['lh'] is not None), None)

    # Lấy mẫu tối đa 30 khung hình đều cho 1 từ
    step = max(1, len(valid_frames) // 30)
    sampled = valid_frames[::step][:30]

    clean_frames = []
    for f in sampled:
        if f['rh'] is not None: last_rh = f['rh']
        if f['lh'] is not None: last_lh = f['lh']

        p = f['pose']
        rs, rw = np.array(p[12]), np.array(p[16])
        ls, lw = np.array(p[11]), np.array(p[15])

        r_rel = rw - rs
        l_rel = lw - ls

        # Tọa độ 3D Avatar (mét):
        r_tx = round(float(r_rel[0] * 1.5), 3)
        r_ty = round(float(-r_rel[1] * 1.5), 3)
        r_tz = round(float(-r_rel[2] * 1.2 + 0.28), 3)

        l_tx = round(float(l_rel[0] * 1.5), 3)
        l_ty = round(float(-l_rel[1] * 1.5), 3)
        l_tz = round(float(-l_rel[2] * 1.2 + 0.28), 3)

        r_hp, r_hy = get_wrist_orientation(last_rh, True)
        l_hp, l_hy = get_wrist_orientation(last_lh, False)

        r_cu = get_hand_curls(last_rh)
        l_cu = get_hand_curls(last_lh)

        clean_frames.append({
            "r_pos": [r_tx, r_ty, r_tz],
            "r_ori": [r_hp, r_hy],
            "r_cu":  r_cu,
            "l_pos": [l_tx, l_ty, l_tz],
            "l_ori": [l_hp, l_hy],
            "l_cu":  l_cu
        })

    return {
        "fps": 20,
        "frames": clean_frames
    }


def main():
    print("=" * 60)
    print("  VSL High-Fidelity Multi-Hand 3D Generator (Fast Optimized)")
    print("=" * 60)

    df = pd.read_csv(LABEL_CSV)
    with open(ENC_PATH, "r", encoding="utf-8") as f:
        enc = json.load(f)
    trained_words = sorted(set(enc.values()))
    print(f"[INFO] Total trained labels: {len(trained_words)}")

    label_to_video = {}
    for _, row in df.iterrows():
        vname = str(row["VIDEO"]).strip()
        label = str(row["LABEL"]).strip()
        vpath = os.path.join(VIDEOS_DIR, vname)
        if os.path.exists(vpath):
            label_to_video.setdefault(label, []).append(vpath)

    holistic = mp.solutions.holistic.Holistic(
        static_image_mode=False,
        model_complexity=0, # Model complexity 0 cho tốc độ xử lý nhanh gấp 3 lần
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    database = {}
    processed = 0

    for label in tqdm(trained_words, desc="Extracting 3D VSL Animations"):
        v_list = label_to_video.get(label, [])
        if not v_list:
            continue

        best_v = max(v_list, key=os.path.getsize)
        anim_data = process_single_video(best_v, holistic)

        if anim_data:
            database[label] = anim_data
            processed += 1

    holistic.close()

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(database, f, ensure_ascii=False)

    size_mb = os.path.getsize(OUT_JSON) / (1024 * 1024)
    print("\n" + "=" * 60)
    print(f"[DONE] Generated 3D animations for {processed}/{len(trained_words)} words")
    print(f"       Database saved -> {OUT_JSON}")
    print(f"       File size      : {size_mb:.2f} MB")
    print("=" * 60)


if __name__ == "__main__":
    main()
