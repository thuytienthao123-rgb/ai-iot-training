"""
train_lstm.py - Vietnamese Sign Language Recognition
Trains a bidirectional LSTM model on MediaPipe hand landmark sequences
extracted by process_videos.py.

Run: python train_lstm.py
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from collections import Counter
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

# ─── Paths ────────────────────────────────────────────────────────────────────
DATASET_PATH = r"t:\AI sign language\VSL\dataset\Dataset"
LABEL_CSV    = os.path.join(DATASET_PATH, "Labels", "label.csv")
FEATURES_DIR = os.path.join(DATASET_PATH, "Features")
MODEL_DIR    = r"t:\AI sign language\VSL\models"
os.makedirs(MODEL_DIR, exist_ok=True)

# ─── Hyper-parameters ─────────────────────────────────────────────────────────
NUM_FRAMES  = 30      # Fixed sequence length (pad / trim to this)
INPUT_SIZE  = 63      # 21 landmarks × 3 (x, y, z)
HIDDEN_SIZE = 256
NUM_LAYERS  = 3
DROPOUT     = 0.4
BATCH_SIZE  = 32
EPOCHS      = 60
LR          = 1e-3
MIN_SAMPLES = 2       # Minimum samples per class to include in training
DEVICE      = "cuda" if torch.cuda.is_available() else "cpu"

print(f"[INFO] Training on: {DEVICE}")


# ─── Dataset ──────────────────────────────────────────────────────────────────
class SignLandmarkDataset(Dataset):
    def __init__(self, samples, labels, num_frames=NUM_FRAMES):
        self.samples    = samples
        self.labels     = labels
        self.num_frames = num_frames

    def _pad_or_trim(self, seq):
        """Uniformly sample or zero-pad to exactly self.num_frames frames."""
        T = seq.shape[0]
        if T >= self.num_frames:
            idx = np.linspace(0, T - 1, self.num_frames, dtype=int)
            return seq[idx]
        pad = np.zeros((self.num_frames - T, seq.shape[1]), dtype=np.float32)
        return np.vstack([seq, pad])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        seq = self.samples[idx]              # (T, 21, 3)
        seq = seq.reshape(seq.shape[0], -1)  # (T, 63)
        seq = self._pad_or_trim(seq)
        return (
            torch.tensor(seq, dtype=torch.float32),
            torch.tensor(self.labels[idx], dtype=torch.long),
        )


# ─── Model ────────────────────────────────────────────────────────────────────
class SignLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, num_classes, dropout=0.4):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size, hidden_size, num_layers,
            batch_first=True, dropout=dropout, bidirectional=True,
        )
        self.norm = nn.LayerNorm(hidden_size * 2)
        self.head = nn.Sequential(
            nn.Linear(hidden_size * 2, 512),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(512, num_classes),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.norm(out[:, -1, :])   # use last time-step
        return self.head(out)


# ─── Load Data ────────────────────────────────────────────────────────────────
print("[INFO] Loading feature files...")
df = pd.read_csv(LABEL_CSV)

X_list, labels_found = [], []

for _, row in df.iterrows():
    npy_name = str(row["VIDEO"]).replace(".mp4", ".npy")
    npy_path = os.path.join(FEATURES_DIR, npy_name)
    if not os.path.exists(npy_path):
        continue
    arr = np.load(npy_path, allow_pickle=True)
    # Handle both old dict format and new array format
    if arr.ndim == 0:       # numpy object array wrapping a dict
        arr = arr.item().get("rh", np.array([]))
    if len(arr) < 3:
        continue
    X_list.append(arr.astype(np.float32))
    labels_found.append(str(row["LABEL"]))

print(f"[INFO] Samples loaded: {len(X_list)}")

if len(X_list) == 0:
    print("[ERROR] No feature files found. Please run process_videos.py first.")
    sys.exit(1)

# ─── Filter classes with too few samples ──────────────────────────────────────
# train_test_split with stratify requires at least 2 samples per class.
label_counts = Counter(labels_found)
kept = [(x, lbl) for x, lbl in zip(X_list, labels_found)
        if label_counts[lbl] >= MIN_SAMPLES]

removed = len(X_list) - len(kept)
if removed > 0:
    print(f"[WARN] Removed {removed} samples from classes with < {MIN_SAMPLES} examples.")

if not kept:
    print("[ERROR] No classes have enough samples to train.")
    sys.exit(1)

X_list, labels_found = zip(*kept)
X_list       = list(X_list)
labels_found = list(labels_found)

# ─── Encode Labels ────────────────────────────────────────────────────────────
le      = LabelEncoder()
y_enc   = le.fit_transform(labels_found)
num_classes = len(le.classes_)
print(f"[INFO] Number of classes: {num_classes}")

# Save label encoder mapping
le_path = os.path.join(MODEL_DIR, "label_encoder.json")
with open(le_path, "w", encoding="utf-8") as f:
    json.dump({int(i): c for i, c in enumerate(le.classes_)}, f,
              ensure_ascii=False, indent=2)
print(f"[INFO] Label mapping saved to {le_path}")

# ─── Train / Val Split ────────────────────────────────────────────────────────
# stratify requires the test_size to be >= number of classes.
min_test_size = max(int(0.15 * len(X_list)), num_classes)
X_train, X_val, y_train, y_val = train_test_split(
    X_list, y_enc, test_size=min_test_size, random_state=42, stratify=y_enc,
)

train_ds = SignLandmarkDataset(X_train, y_train)
val_ds   = SignLandmarkDataset(X_val,   y_val)
train_dl = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                      num_workers=0, pin_memory=(DEVICE == "cuda"))
val_dl   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                      num_workers=0, pin_memory=(DEVICE == "cuda"))

print(f"[INFO] Train: {len(train_ds)} | Val: {len(val_ds)}")

# ─── Model, Loss, Optimizer ───────────────────────────────────────────────────
model = SignLSTM(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS, num_classes, DROPOUT).to(DEVICE)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

print(f"\n[INFO] Model parameters: {sum(p.numel() for p in model.parameters()):,}")
print("[INFO] Starting training...\n")

# ─── Training Loop ────────────────────────────────────────────────────────────
best_val_acc = 0.0
ckpt_path    = os.path.join(MODEL_DIR, "best_model.pth")

for epoch in range(1, EPOCHS + 1):
    # ── Train ──
    model.train()
    train_loss = train_correct = 0

    for xb, yb in train_dl:
        xb, yb = xb.to(DEVICE), yb.to(DEVICE)
        optimizer.zero_grad()
        logits = model(xb)
        loss   = criterion(logits, yb)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        train_loss    += loss.item() * xb.size(0)
        train_correct += (logits.argmax(1) == yb).sum().item()

    scheduler.step()

    # ── Validate ──
    model.eval()
    val_loss = val_correct = 0
    with torch.no_grad():
        for xb, yb in val_dl:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            logits = model(xb)
            val_loss    += criterion(logits, yb).item() * xb.size(0)
            val_correct += (logits.argmax(1) == yb).sum().item()

    t_acc = train_correct / len(train_ds) * 100
    v_acc = val_correct   / len(val_ds)   * 100
    t_ls  = train_loss    / len(train_ds)
    v_ls  = val_loss      / len(val_ds)

    is_best = v_acc > best_val_acc
    marker  = " *** BEST ***" if is_best else ""
    print(
        f"Epoch [{epoch:3d}/{EPOCHS}] "
        f"Train Loss: {t_ls:.4f}  Acc: {t_acc:5.1f}% | "
        f"Val Loss: {v_ls:.4f}  Acc: {v_acc:5.1f}%{marker}"
    )

    if is_best:
        best_val_acc = v_acc
        torch.save(
            {
                "epoch":       epoch,
                "model_state": model.state_dict(),
                "val_acc":     v_acc,
                "num_classes": num_classes,
                "input_size":  INPUT_SIZE,
                "hidden_size": HIDDEN_SIZE,
                "num_layers":  NUM_LAYERS,
            },
            ckpt_path,
        )

print(f"\n[DONE] Best validation accuracy: {best_val_acc:.2f}%")
print(f"[DONE] Best model saved to:      {ckpt_path}")
