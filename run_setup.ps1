$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvDir   = Join-Path $scriptDir "venv_vsl"
$vpy       = Join-Path $venvDir "Scripts\python.exe"
$vpip      = Join-Path $venvDir "Scripts\pip.exe"

# ─── Tạo venv nếu chưa có ────────────────────────────────────────────────────
if (-Not (Test-Path $vpy)) {
    Write-Host "Creating virtual environment 'venv_vsl'..." -ForegroundColor Cyan
    $sysPy = "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
    if (-Not (Test-Path $sysPy)) {
        Write-Host "[ERROR] Python 3.11 not found at: $sysPy" -ForegroundColor Red
        Write-Host "Please install Python 3.11 from python.org" -ForegroundColor Yellow
        exit 1
    }
    & $sysPy -m venv $venvDir
    Write-Host "Venv created." -ForegroundColor Green
}

# ── Cài / cập nhật dependencies ───────────────────────────────────────────────
Write-Host "`nInstalling / updating dependencies in venv..." -ForegroundColor Cyan
& $vpy -m pip install --upgrade pip --quiet

# Core packages (mediapipe standalone — NO TensorFlow)
& $vpy -m pip install `
    "mediapipe==0.10.9" `
    "opencv-python" `
    "numpy<2" `
    "pandas" `
    "scikit-learn" `
    "tqdm" `
    --quiet

# PyTorch — detect GPU
$hasCuda = (Get-Command nvidia-smi -ErrorAction SilentlyContinue) -ne $null
if ($hasCuda) {
    Write-Host "NVIDIA GPU detected — installing CUDA build of PyTorch..." -ForegroundColor Cyan
    & $vpy -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121 --quiet
} else {
    Write-Host "No GPU detected — installing CPU build of PyTorch..." -ForegroundColor Yellow
    & $vpy -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu --quiet
}

Write-Host "Dependencies OK." -ForegroundColor Green

# ── Kiểm tra dataset ──────────────────────────────────────────────────────────
$videosDir = Join-Path $scriptDir "dataset\Dataset\Videos"
if (-Not (Test-Path $videosDir)) {
    Write-Host "`n[ERROR] Videos folder not found: $videosDir" -ForegroundColor Red
    Write-Host "Please place the Videos folder at the path above." -ForegroundColor Yellow
    exit 1
}
$videoCount = (Get-ChildItem $videosDir -Filter "*.mp4").Count
Write-Host "Found $videoCount video files." -ForegroundColor Green

# ── Step 1: Trích xuất landmarks ──────────────────────────────────────────────
Write-Host "`n[Step 1/2] Extracting hand landmarks from videos..." -ForegroundColor Cyan
& $vpy (Join-Path $scriptDir "process_videos.py")
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] process_videos.py failed (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

# ── Step 2: Train LSTM ────────────────────────────────────────────────────────
Write-Host "`n[Step 2/2] Training LSTM model..." -ForegroundColor Cyan
& $vpy (Join-Path $scriptDir "train_lstm.py")
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] train_lstm.py failed (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`nAll done! Trained model: $scriptDir\models\best_model.pth" -ForegroundColor Green
