"""
process_videos.py - Trích xuất MediaPipe Hand Landmarks từ toàn bộ video VSL.
Xuất file .npy (features dùng để train LSTM) và .sigml (HamNoSys).

Chạy với: python process_videos.py
"""

import os
import sys

# Suppress TF/oneDNN noise before any import
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["GLOG_minloglevel"] = "3"

import cv2
import pandas as pd
import numpy as np
from tqdm import tqdm

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hamnosys_mapper import (
    get_handshape_sigml, get_palm_orientation_sigml,
    get_movement_sigml, get_location_sigml, create_sigml
)

# Import mediapipe LAST to avoid protobuf conflicts with TF
import mediapipe as mp

print(f"[INFO] MediaPipe version: {mp.__version__}")
has_solutions = hasattr(mp, "solutions") and hasattr(mp.solutions, "holistic")
print(f"[INFO] Using {'solutions.holistic' if has_solutions else 'tasks API'}")

# ─── Paths ────────────────────────────────────────────────────────────────────
DATASET_PATH = r"t:\AI sign language\VSL\dataset\Dataset"
LABEL_CSV    = os.path.join(DATASET_PATH, "Labels", "label.csv")
VIDEOS_DIR   = os.path.join(DATASET_PATH, "Videos")
SIGML_DIR    = os.path.join(DATASET_PATH, "SiGML")
FEATURES_DIR = os.path.join(DATASET_PATH, "Features")

os.makedirs(SIGML_DIR, exist_ok=True)
os.makedirs(FEATURES_DIR, exist_ok=True)


# ─── Extract landmarks from a single video ────────────────────────────────────
def _landmarks_to_list(lm_proto):
    """Convert MediaPipe NormalizedLandmarkList to list of [x, y, z]."""
    return [[lm.x, lm.y, lm.z] for lm in lm_proto.landmark]


def extract_landmarks_solutions(video_path: str):
    """
    Extract hand landmarks using the legacy mp.solutions.holistic API.
    Returns (right_hand_frames, left_hand_frames) as lists of 21×3 arrays.
    Uses 'with' context manager so Holistic is always properly closed.
    """
    all_rh, all_lh = [], []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return all_rh, all_lh

    try:
        holistic_cls = mp.solutions.holistic.Holistic
        with holistic_cls(
            static_image_mode=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as holistic:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rgb.flags.writeable = False
                res = holistic.process(rgb)
                if res.right_hand_landmarks:
                    all_rh.append(_landmarks_to_list(res.right_hand_landmarks))
                if res.left_hand_landmarks:
                    all_lh.append(_landmarks_to_list(res.left_hand_landmarks))
    finally:
        cap.release()

    return all_rh, all_lh


def extract_landmarks_tasks(video_path: str):
    """
    Extract hand landmarks using the newer mediapipe Tasks API.
    Returns (right_hand_frames, left_hand_frames).
    """
    all_rh, all_lh = [], []

    from mediapipe.tasks import python as mp_py
    from mediapipe.tasks.python import vision as mp_vision

    model_path = os.path.join(os.path.dirname(__file__), "hand_landmarker.task")
    if not os.path.exists(model_path):
        import urllib.request
        url = (
            "https://storage.googleapis.com/mediapipe-models/"
            "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
        )
        tqdm.write(f"[INFO] Downloading model to {model_path}...")
        urllib.request.urlretrieve(url, model_path)

    opts = mp_vision.HandLandmarkerOptions(
        base_options=mp_py.BaseOptions(model_asset_path=model_path),
        num_hands=2,
        running_mode=mp_vision.RunningMode.VIDEO,
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return all_rh, all_lh

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    try:
        with mp_vision.HandLandmarker.create_from_options(opts) as detector:
            fi = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                ts_ms = int(fi * 1000 / fps)
                result = detector.detect_for_video(img, ts_ms)
                for i, hand_info in enumerate(result.handedness):
                    lms = [[lm.x, lm.y, lm.z] for lm in result.hand_landmarks[i]]
                    if hand_info[0].category_name == "Right":
                        all_rh.append(lms)
                    else:
                        all_lh.append(lms)
                fi += 1
    finally:
        cap.release()

    return all_rh, all_lh


def extract_landmarks(video_path: str):
    """Dispatcher: use solutions API when available, fall back to tasks."""
    if has_solutions:
        return extract_landmarks_solutions(video_path)
    return extract_landmarks_tasks(video_path)


# ─── SiGML generation helper ──────────────────────────────────────────────────
def build_sigml(rh_frames, lh_frames, label):
    """
    Build a SiGML string from the dominant (right) hand frames and,
    if available, the non-dominant (left) hand frames.

    Uses the middle frame for static pose and first/last for movement.
    """
    # --- dominant hand (prefer right, fall back to left) ---
    dom_frames = rh_frames if len(rh_frames) >= 3 else lh_frames
    if len(dom_frames) < 3:
        return None

    mid_dom   = dom_frames[len(dom_frames) // 2]
    start_dom = dom_frames[0]
    end_dom   = dom_frames[-1]

    hs_dom  = get_handshape_sigml(mid_dom)
    ori_dom = get_palm_orientation_sigml(mid_dom)
    loc_dom = get_location_sigml(mid_dom)
    # wrist is landmark index 0 — explicitly named for clarity
    wrist_start_dom = start_dom[0]
    wrist_end_dom   = end_dom[0]
    mov_dom = get_movement_sigml(wrist_start_dom, wrist_end_dom)

    # --- non-dominant hand (opposite of dominant) ---
    ndom_frames = lh_frames if len(rh_frames) >= 3 else rh_frames
    hs_l = ori_l = loc_l = mov_l = None

    if len(ndom_frames) >= 3:
        mid_ndom   = ndom_frames[len(ndom_frames) // 2]
        start_ndom = ndom_frames[0]
        end_ndom   = ndom_frames[-1]

        hs_l  = get_handshape_sigml(mid_ndom)
        ori_l = get_palm_orientation_sigml(mid_ndom)
        loc_l = get_location_sigml(mid_ndom)
        mov_l = get_movement_sigml(start_ndom[0], end_ndom[0])

    return create_sigml(
        handshape=hs_dom,
        orientation=ori_dom,
        movement=mov_dom,
        location=loc_dom,
        gloss=label,
        handshape_l=hs_l,
        orientation_l=ori_l,
        movement_l=mov_l,
        location_l=loc_l,
    )


# ─── Main ─────────────────────────────────────────────────────────────────────
df = pd.read_csv(LABEL_CSV)
print(f"[INFO] Total entries: {len(df)}")
print("=" * 60)

processed = skipped = no_hand = failed = 0

for _, row in tqdm(df.iterrows(), total=len(df), desc="Processing"):
    video_name = str(row["VIDEO"])
    label      = str(row["LABEL"])
    video_path = os.path.join(VIDEOS_DIR, video_name)
    npy_path   = os.path.join(FEATURES_DIR, video_name.replace(".mp4", ".npy"))
    sigml_path = os.path.join(SIGML_DIR,    video_name.replace(".mp4", ".sigml"))

    # Resume: skip already done
    if os.path.exists(npy_path) and os.path.exists(sigml_path):
        skipped += 1
        continue

    if not os.path.exists(video_path):
        tqdm.write(f"[WARN] Not found: {video_name}")
        failed += 1
        continue

    try:
        rh_frames, lh_frames = extract_landmarks(video_path)

        # Dominant hand: prefer right, fall back to left
        dom_frames = rh_frames if len(rh_frames) >= 3 else lh_frames

        if len(dom_frames) < 3:
            no_hand += 1
            continue

        # Save feature array (dominant hand frames)
        np.save(npy_path, np.array(dom_frames, dtype=np.float32))

        # Build and save SiGML (includes left hand if detected)
        xml = build_sigml(rh_frames, lh_frames, label)
        if xml is None:
            no_hand += 1
            continue

        with open(sigml_path, "w", encoding="utf-8") as f:
            f.write(xml)

        processed += 1

    except Exception as e:
        tqdm.write(f"[ERROR] {video_name}: {e}")
        failed += 1

print()
print("=" * 60)
print(f"  Processed  : {processed}")
print(f"  Skipped    : {skipped}  (already cached)")
print(f"  No hand    : {no_hand}")
print(f"  Failed     : {failed}")
print("  Done!")
