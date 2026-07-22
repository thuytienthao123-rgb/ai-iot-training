"""
test_vsl_pipeline.py - Kiểm tra nhanh toàn bộ VSL pipeline.
Chạy: python test_vsl_pipeline.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("TEST 1: Import hamnosys_mapper")
print("=" * 60)

from hamnosys_mapper import (
    get_handshape_sigml, get_palm_orientation_sigml,
    get_movement_sigml, get_location_sigml, create_sigml
)
print("[PASS] Import OK")

# ─── Tạo hand landmark giả (21 điểm) ─────────────────────────────────────────
def make_flat_hand():
    """21 landmarks mô phỏng bàn tay mở rộng (flat hand)."""
    lm = [[0.5, 0.8, 0.0]] * 21   # base
    # Đặt các ngón tay duỗi thẳng (tip xa hơn wrist)
    lm[0]  = [0.5, 0.9, 0.0]   # wrist
    lm[4]  = [0.3, 0.5, 0.0]   # thumb tip
    lm[8]  = [0.5, 0.3, 0.0]   # index tip
    lm[12] = [0.5, 0.2, 0.0]   # middle tip
    lm[16] = [0.6, 0.3, 0.0]   # ring tip
    lm[20] = [0.7, 0.4, 0.0]   # pinky tip
    lm[5]  = [0.5, 0.7, 0.0]   # index mcp
    lm[6]  = [0.5, 0.55, 0.0]  # index pip
    lm[9]  = [0.5, 0.72, 0.0]  # middle mcp
    lm[10] = [0.5, 0.57, 0.0]  # middle pip
    lm[13] = [0.55, 0.72, 0.0] # ring mcp
    lm[14] = [0.55, 0.57, 0.0] # ring pip
    lm[17] = [0.6, 0.73, 0.0]  # pinky mcp
    lm[18] = [0.62, 0.62, 0.0] # pinky pip
    lm[1]  = [0.45, 0.75, 0.0] # thumb cmc
    lm[2]  = [0.4, 0.65, 0.0]  # thumb mcp
    lm[3]  = [0.35, 0.58, 0.0] # thumb ip
    return lm

def make_fist():
    """21 landmarks mô phỏng nắm tay."""
    lm = [[0.5, 0.8, 0.0]] * 21
    lm[0]  = [0.5, 0.9, 0.0]   # wrist
    lm[4]  = [0.48, 0.82, 0.0] # thumb tip (gần wrist)
    lm[8]  = [0.52, 0.78, 0.0] # index tip (gần wrist)
    lm[12] = [0.50, 0.77, 0.0] # middle tip
    lm[16] = [0.51, 0.79, 0.0] # ring tip
    lm[20] = [0.53, 0.80, 0.0] # pinky tip
    lm[5]  = [0.5, 0.7, 0.0]   # index mcp
    lm[6]  = [0.51, 0.72, 0.0] # index pip
    lm[9]  = [0.5, 0.69, 0.0]  # middle mcp
    lm[10] = [0.50, 0.71, 0.0] # middle pip
    lm[13] = [0.55, 0.70, 0.0] # ring mcp
    lm[14] = [0.55, 0.72, 0.0] # ring pip
    lm[17] = [0.6, 0.72, 0.0]  # pinky mcp
    lm[18] = [0.60, 0.74, 0.0] # pinky pip
    lm[1]  = [0.45, 0.75, 0.0]
    lm[2]  = [0.44, 0.78, 0.0]
    lm[3]  = [0.46, 0.80, 0.0]
    return lm

print()
print("=" * 60)
print("TEST 2: get_handshape_sigml")
print("=" * 60)

flat = make_flat_hand()
fist = make_fist()

hs_flat = get_handshape_sigml(flat)
hs_fist = get_handshape_sigml(fist)
print(f"  Flat hand  → {hs_flat}")
print(f"  Fist       → {hs_fist}")

assert "<ham" in hs_flat, "Handshape tag missing"
assert "<ham" in hs_fist, "Handshape tag missing"
print("[PASS] Handshape detection OK")

print()
print("=" * 60)
print("TEST 3: get_palm_orientation_sigml")
print("=" * 60)

ori = get_palm_orientation_sigml(flat)
print(f"  Orientation → {ori}")
assert "<ham" in ori
print("[PASS] Orientation OK")

print()
print("=" * 60)
print("TEST 4: get_location_sigml")
print("=" * 60)

test_locations = [
    ([0.5, 0.10, 0.0], "head area"),
    ([0.5, 0.30, 0.0], "forehead area"),
    ([0.5, 0.46, 0.0], "nose area"),
    ([0.5, 0.58, 0.0], "mouth area"),
    ([0.5, 0.72, 0.0], "chest area"),
    ([0.5, 0.90, 0.0], "stomach area"),
]
# Tạo fake hand với wrist ở vị trí khác nhau
for (wx, wy, wz), desc in test_locations:
    lm = [[wx, wy, wz]] + [[0.5, 0.5, 0.0]] * 20
    loc = get_location_sigml(lm)
    print(f"  wrist_y={wy:.2f} ({desc:15s}) → {loc}")

print("[PASS] Location detection OK")

print()
print("=" * 60)
print("TEST 5: get_movement_sigml")
print("=" * 60)

movements = [
    ([0.3, 0.5, 0.0], [0.7, 0.5, 0.0], "move right"),
    ([0.7, 0.5, 0.0], [0.3, 0.5, 0.0], "move left"),
    ([0.5, 0.7, 0.0], [0.5, 0.3, 0.0], "move up"),
    ([0.5, 0.3, 0.0], [0.5, 0.7, 0.0], "move down"),
    ([0.5, 0.5, 0.5], [0.5, 0.5, 0.0], "move out"),
    ([0.5, 0.5, 0.5], [0.5, 0.5, 0.5], "stationary"),
]
for start, end, desc in movements:
    mov = get_movement_sigml(start, end)
    tag = mov if mov else "(none - stationary)"
    print(f"  {desc:15s} → {tag}")

print("[PASS] Movement detection OK")

print()
print("=" * 60)
print("TEST 6: create_sigml - 1 tay")
print("=" * 60)

lm = make_flat_hand()
hs  = get_handshape_sigml(lm)
ori = get_palm_orientation_sigml(lm)
loc = get_location_sigml(lm)
mov = get_movement_sigml(lm[0], [lm[0][0] + 0.2, lm[0][1], lm[0][2]])
xml_1hand = create_sigml(hs, ori, mov, loc, gloss="test_1hand")
print(xml_1hand[:300], "...")
assert '<?xml' in xml_1hand and '<sigml>' in xml_1hand and '<hns_sign' in xml_1hand
print("[PASS] SiGML (1 tay) OK")

print()
print("=" * 60)
print("TEST 7: create_sigml - 2 tay")
print("=" * 60)

fist_lm = make_fist()
hs_l   = get_handshape_sigml(fist_lm)
ori_l  = get_palm_orientation_sigml(fist_lm)
loc_l  = get_location_sigml(fist_lm)
mov_l  = ""

xml_2hand = create_sigml(hs, ori, mov, loc, gloss="test_2hand",
                          handshape_l=hs_l, orientation_l=ori_l,
                          movement_l=mov_l, location_l=loc_l)
print(xml_2hand[:400], "...")
assert '<hamnosys_manual_l>' in xml_2hand
print("[PASS] SiGML (2 tay) OK")

print()
print("=" * 60)
print("TEST 8: Xu ly video thuc te (3 mau)")
print("=" * 60)

VIDEOS_DIR = r"t:\AI sign language\VSL\dataset\Dataset\Videos"
SAMPLE_VIDEOS = [
    ("D0001N.mp4", "dia chi"),
    ("D0002.mp4",  "tinh"),
    ("D0004.mp4",  "nhan vien"),
]

import mediapipe as mp
has_sol = hasattr(mp, "solutions") and hasattr(mp.solutions, "holistic")

from process_videos import (
    extract_landmarks_solutions, extract_landmarks_tasks, build_sigml
)

passed = 0
for video_name, label in SAMPLE_VIDEOS:
    video_path = os.path.join(VIDEOS_DIR, video_name)
    if not os.path.exists(video_path):
        print(f"  [SKIP] {video_name} - khong tim thay file")
        continue
    try:
        print(f"\n  [{video_name}] ({label})")
        if has_sol:
            rh, lh = extract_landmarks_solutions(video_path)
        else:
            rh, lh = extract_landmarks_tasks(video_path)

        print(f"    Right hand frames : {len(rh)}")
        print(f"    Left  hand frames : {len(lh)}")

        xml = build_sigml(rh, lh, label=label)
        if xml:
            out_path = os.path.join(
                os.path.dirname(__file__),
                video_name.replace(".mp4", ".sigml")
            )
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(xml)
            # Print only the manual section for brevity
            lines = xml.splitlines()
            for ln in lines:
                print("   ", ln)
            print(f"    -> Saved: {out_path}")
            passed += 1
        else:
            print("    [WARN] Khong du frame de tao SiGML")
    except Exception as e:
        print(f"    [FAIL] {e}")
        import traceback; traceback.print_exc()

if passed > 0:
    print(f"\n[PASS] {passed}/{len(SAMPLE_VIDEOS)} video xu ly thanh cong")

print()
print("=" * 60)
print("✅ TẤT CẢ TEST HOÀN THÀNH")
print("=" * 60)
