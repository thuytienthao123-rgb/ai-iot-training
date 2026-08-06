# VoiceAI - Khởi động Server
# Chạy script này để cài đặt và khởi động backend

Write-Host "===============================" -ForegroundColor Cyan
Write-Host "  VoiceAI Backend Server Setup" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Python path (Python 3.11)
$PYTHON = "C:\Users\tient\AppData\Local\Programs\Python\Python311\python.exe"
if (-not (Test-Path $PYTHON)) {
    # Fallback
    $PYTHON = "python"
}
Write-Host "[OK] Python: $PYTHON" -ForegroundColor Green

# Cài đặt dependencies
Write-Host "`nCài đặt dependencies..." -ForegroundColor Yellow
& $PYTHON -m pip install -r requirements.txt -q

# Tạo file .env nếu chưa có
if (-not (Test-Path ".env")) {
    Write-Host "`nTạo file .env..." -ForegroundColor Yellow
    $apiKey = Read-Host "Nhập Groq API Key của bạn (lấy tại console.groq.com)"
    @"
GROQ_API_KEY=$apiKey
FLASK_PORT=5050
FLASK_DEBUG=false
"@ | Out-File -Encoding UTF8 ".env"
    Write-Host "[OK] Đã tạo file .env" -ForegroundColor Green
} else {
    Write-Host "[OK] File .env đã tồn tại" -ForegroundColor Green
}

Write-Host "`n===============================" -ForegroundColor Cyan
Write-Host "  Khởi động server..." -ForegroundColor Cyan
Write-Host "  URL: http://localhost:5050" -ForegroundColor White
Write-Host "  Mở index.html trong trình duyệt" -ForegroundColor White
Write-Host "===============================" -ForegroundColor Cyan

# Khởi động Flask server
& $PYTHON server.py
