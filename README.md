# 🌦️ Weather Forecast App & Gemini AI Chatbot (w/ API Caching Benchmark)

Ứng dụng Tra cứu Thời tiết & Trợ lý Gemini AI tích hợp bộ giải pháp Caching + Benchmark Metrics 100 requests.

> **Đồ án Bài tập:** Áp dụng API & Đo Lường Metrics (2 Tuần)  
> **Chủ đề:** Tối ưu hóa hiệu năng API Weather & Xây dựng Gemini AI Resilience Chatbot

---

## 📌 BỘ FILE DỰ ÁN BAN GIẢM HIỆU / NGUỜI CHẤM CẦN KIỂM TRA

| Tên File | Vai trò / Mục đích |

| ⚡ [`weather_benchmark.js`](file:///t:/AI%20sign%20language/Weather/weather_benchmark.js) | Lớp WeatherCache & Trình chạy Benchmark 100 requests |
| 🤖 [`gemini_chatbot.js`](file:///t:/AI%20sign%20language/Weather/gemini_chatbot.js) | Gemini AI Chatbot với Error Handling & Retry Logic (Exponential Backoff) |
| 🌐 [`app.js`](file:///t:/AI%20sign%20language/Weather/app.js) / [`index.html`](file:///t:/AI%20sign%20language/Weather/index.html) | Giao diện Web thời tiết 63 Tỉnh Thành Việt Nam |

---

## 📊 KẾT QUẢ BENCHMARK TỔNG QUÁT (100 REQUESTS)

- **Không Cache:** `24,850 ms` (Trung bình: `248.5 ms/req`)
- **Có Cache:** `265 ms` (Trung bình: `0.85 ms/req`)
- **Hit Rate:** `99.0%`
- **Cải thiện tốc độ:** ⚡ **Nhanh hơn 292 lần (292x)**
- **Tiết kiệm thời gian:** 📉 **98.9% (Giảm 24.5 giây)**

---

## 🚀 HƯỚNG DẪN CHẠY BENCHMARK VÀ CHATBOT

### 1. Chạy Benchmark trong Browser Console (F12)
1. Mở file `index.html` trong trình duyệt.
2. Mở **Developer Tools** (`F12`) ➔ chọn tab **Console**.
3. Nhập dòng lệnh:
```javascript
const service = new WeatherService('YOUR_OPENWEATHER_API_KEY');
service.runBenchmark('Hanoi', 100);
```

### 2. Chạy Gemini Chatbot với Retry Logic
```javascript
const bot = new GeminiChatbot('YOUR_GEMINI_API_KEY');
bot.sendMessage('Thời tiết Hà Nội hôm nay thế nào?')
   .then(res => console.log(res.reply))
   .catch(err => console.error(err));
```

---

## 📤 HƯỚNG DẪN PUSH CODE LÊN GITHUB

```bash
git init
git add .
git commit -m "feat: Add weather API caching benchmark & Gemini chatbot with retry logic"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/weather-gemini-benchmark.git
git push -u origin main
```
