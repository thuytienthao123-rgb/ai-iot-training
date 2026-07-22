"""
Sign Language Recognition - Model Training Script for Kaggle

This script trains a CNN model to recognize sign language gestures.
Dataset format: folder structure with class names as folders containing images

Usage on Kaggle:
1. Upload dataset to Kaggle
2. Run this notebook
3. Download trained model.pt
4. Place in ai-model/model/ locally
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import torchvision.transforms as transforms
from torchvision.models import resnet18, resnet50
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
from tqdm import tqdm
import json
from pathlib import Path

# ============ CONFIG ============
DATASET_PATH = "./dataset"  # Changed to local dataset path
BATCH_SIZE = 32
EPOCHS = 50
LEARNING_RATE = 0.001
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_SAVE_PATH = "./sign_language_model.pt"
NUM_CLASSES = 26  # Adjust based on your dataset (A-Z or custom classes)
IMAGE_SIZE = 224

print(f"Using device: {DEVICE}")

# ============ DATA LOADING ============

class SignLanguageDataset(Dataset):
    """Custom dataset loader for sign language images"""
    
    def __init__(self, root_dir, transform=None):
        self.root_dir = Path(root_dir)
        self.transform = transform
        self.images = []
        self.labels = []
        self.class_to_idx = {}
        self.idx_to_class = {}
        
        # Build class mappings
        class_dirs = sorted([d for d in self.root_dir.iterdir() if d.is_dir()])
        for idx, class_dir in enumerate(class_dirs):
            class_name = class_dir.name
            self.class_to_idx[class_name] = idx
            self.idx_to_class[idx] = class_name
            
            # Load images
            for img_path in class_dir.glob("*.jpg"):
                self.images.append(str(img_path))
                self.labels.append(idx)
            for img_path in class_dir.glob("*.png"):
                self.images.append(str(img_path))
                self.labels.append(idx)
    
    def __len__(self):
        return len(self.images)
    
    def __getitem__(self, idx):
        img_path = self.images[idx]
        label = self.labels[idx]
        
        image = Image.open(img_path).convert("RGB")
        
        if self.transform:
            image = self.transform(image)
        
        return image, label

# ============ DATA TRANSFORMS ============

train_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

val_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# ============ MODEL ARCHITECTURE ============

class SignLanguageModel(nn.Module):
    """ResNet-18 based model for sign language classification"""
    
    def __init__(self, num_classes=26):
        super(SignLanguageModel, self).__init__()
        self.backbone = resnet18(pretrained=True)
        self.backbone.fc = nn.Linear(512, num_classes)
    
    def forward(self, x):
        return self.backbone(x)

# ============ TRAINING FUNCTION ============

def train_epoch(model, train_loader, criterion, optimizer, device):
    """Train for one epoch"""
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    progress_bar = tqdm(train_loader, desc="Training")
    for images, labels in progress_bar:
        images, labels = images.to(device), labels.to(device)
        
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        _, predicted = torch.max(outputs.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()
        
        progress_bar.set_postfix({
            'loss': total_loss / (progress_bar.n + 1),
            'accuracy': 100 * correct / total
        })
    
    return total_loss / len(train_loader), 100 * correct / total

def validate(model, val_loader, criterion, device):
    """Validate model"""
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    
    with torch.no_grad():
        for images, labels in tqdm(val_loader, desc="Validating"):
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)
            
            total_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
    
    return total_loss / len(val_loader), 100 * correct / total

# ============ MAIN TRAINING LOOP ============

def main():
    print("=" * 60)
    print("Sign Language Recognition Model Training")
    print("=" * 60)
    
    # Check dataset
    dataset_root = Path(DATASET_PATH)
    if not dataset_root.exists():
        print(f"Error: Dataset path not found: {DATASET_PATH}")
        return
    
    # Load dataset
    print(f"\nLoading dataset from {DATASET_PATH}...")
    dataset = SignLanguageDataset(DATASET_PATH, transform=train_transform)
    print(f"Dataset size: {len(dataset)}")
    print(f"Classes: {len(dataset.class_to_idx)}")
    print(f"Classes: {list(dataset.class_to_idx.keys())}")
    
    # Split train/val (80/20)
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(
        dataset, [train_size, val_size]
    )
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)
    
    # Model setup
    print("\nInitializing model...")
    model = SignLanguageModel(num_classes=len(dataset.class_to_idx))
    model = model.to(DEVICE)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=5, verbose=True
    )
    
    # Training loop
    print(f"\nTraining for {EPOCHS} epochs...\n")
    
    history = {
        'train_loss': [],
        'train_acc': [],
        'val_loss': [],
        'val_acc': []
    }
    
    best_val_acc = 0
    patience_counter = 0
    patience_limit = 10
    
    for epoch in range(EPOCHS):
        print(f"\nEpoch {epoch+1}/{EPOCHS}")
        
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, DEVICE)
        val_loss, val_acc = validate(model, val_loader, criterion, DEVICE)
        
        history['train_loss'].append(train_loss)
        history['train_acc'].append(train_acc)
        history['val_loss'].append(val_loss)
        history['val_acc'].append(val_acc)
        
        print(f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}%")
        print(f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%")
        
        scheduler.step(val_loss)
        
        # Early stopping
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            patience_counter = 0
            # Save best model
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'class_to_idx': dataset.class_to_idx,
                'idx_to_class': dataset.idx_to_class,
            }, MODEL_SAVE_PATH)
            print(f"✓ Best model saved! Val Acc: {best_val_acc:.2f}%")
        else:
            patience_counter += 1
            if patience_counter >= patience_limit:
                print(f"\nEarly stopping at epoch {epoch+1}")
                break
    
    # Plot training history
    print("\n" + "=" * 60)
    print("Training Complete!")
    print("=" * 60)
    
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    plt.plot(history['train_loss'], label='Train')
    plt.plot(history['val_loss'], label='Val')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.title('Loss over Epochs')
    
    plt.subplot(1, 2, 2)
    plt.plot(history['train_acc'], label='Train')
    plt.plot(history['val_acc'], label='Val')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy (%)')
    plt.legend()
    plt.title('Accuracy over Epochs')
    
    plt.tight_layout()
    plt.savefig('./training_history.png')
    plt.show()
    
    print(f"\nModel saved to: {MODEL_SAVE_PATH}")
    print(f"Best Validation Accuracy: {best_val_acc:.2f}%")

if __name__ == "__main__":
    main()
