# VoiceAI — Giao diện STT & TTS

Giao diện web chuyển đổi linh hoạt giữa **Speech-to-Text** (Groq Whisper) và **Text-to-Speech** (Microsoft Edge TTS).

## Kiến trúc

```
Frontend (index.html)
    │
    ├── POST /api/stt ──→ Groq Whisper API (cloud)
    │                     • Model: whisper-large-v3-turbo  
    │                     • Độ chính xác: ~95% tiếng Việt
    │                     • Latency: ~1-2s
    │
    └── POST /api/tts ──→ edge-tts (Microsoft Edge cloud)
                          • Giọng: vi-VN-HoaiMyNeural, vi-VN-NamMinhNeural
                          • Miễn phí, không API key
                          • Latency: ~1-3s
```

## Yêu cầu hệ thống

- Python 3.9+
- Kết nối Internet (cho Groq API + edge-tts)
- **Không cần GPU!** — Tất cả xử lý trên cloud

## Cài đặt nhanh

### Bước 1: Cài dependencies

```powershell
pip install flask flask-cors groq edge-tts python-dotenv
```

### Bước 2: Khởi động server

```powershell
# Dùng script tự động:
.\start.ps1

# Hoặc thủ công:
python server.py
```

### Bước 3: Mở giao diện và cấu hình API Key

1. Mở file `index.html` trong trình duyệt Chrome/Edge.
2. Nhấn vào nút cài đặt (hình bánh răng ⚙️) ở góc dưới màn hình.
3. Nhập **Groq API Key** của bạn (Lấy key miễn phí tại: [https://console.groq.com](https://console.groq.com)).

---

## Tính năng

### Speech-to-Text (STT)
- 🎤 Ghi âm trực tiếp từ microphone
- 🌊 Hiển thị waveform animation thời gian thực
- 🌐 Hỗ trợ: Tiếng Việt, English, Auto-detect
- ⏱ Phản hồi trong ~1-2 giây

### Text-to-Speech (TTS)
- 📝 Nhập văn bản hoặc dán từ STT
- 🎙 Chọn giọng: Hoài My (nữ), Nam Minh (nam), v.v.
- ⚡ Điều chỉnh tốc độ và cao độ
- 🎵 Audio player tích hợp với download

### Giao diện
- 🌙 Dark glassmorphism design
- ⇄ Chuyển đổi STT ↔ TTS một chạm
- 📋 Lịch sử hoạt động
- ⚙️ Cài đặt server linh hoạt

---

## API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/health` | GET | Kiểm tra server |
| `/api/stt` | POST | Nhận dạng giọng nói |
| `/api/tts` | POST | Tổng hợp giọng nói |
| `/api/tts/voices` | GET | Danh sách giọng |

---

## Hiệu suất

| Metric | Mục tiêu | Thực tế |
|--------|----------|---------|
| Độ chính xác STT | ≥90% | ~95% (Whisper Large v3) |
| Latency STT | ≤5s | ~1-2s |
| Latency TTS | ≤5s | ~1-3s |
| RAM sử dụng | Nhẹ | ~50MB (Flask only) |
| GPU | Không cần | ✅ |
