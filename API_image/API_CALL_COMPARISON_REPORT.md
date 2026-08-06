BÁO CÁO NGHIÊN CỨU & SO SÁNH 3 PHƯƠNG PHÁP GỌI API
(Synchronous, Batch Processing, Asynchronous) Trong Dự Án Tạo & Tải Hình Ảnh AI

1. TỔNG QUAN & ĐẶT VẤN ĐỀ
Trong các hệ thống phần mềm hiện đại — đặc biệt là các ứng dụng xử lý hình ảnh AI, tìm kiếm dữ liệu đa phương tiện hoặc tích hợp API từ các dịch vụ bên thứ ba (như Unsplash API, Gemini Vision API, Stability AI, Pollinations AI) — việc gọi API một cách hiệu quả đóng vai trò quyết định tới:
- Tốc độ phản hồi (Latency): Thời gian người dùng phải chờ đợi để nhận được kết quả.
- Băng thông & Năng suất (Throughput): Số lượng yêu cầu (requests) hệ thống có thể xử lý trong một đơn vị thời gian.
- Tải hệ thống & Tài nguyên (Resource Consumption): Mức độ tiêu thụ CPU, RAM, Network Sockets.
- Độ ổn định & Khả năng chịu lỗi (Resilience & Rate Limit): Khả năng chống chịu khi chạm ngưỡng giới hạn (Rate Limits / HTTP 429) hoặc mạng bị chập chờn.
Báo cáo này phân tích và so sánh 3 mô hình gọi API phổ biến với giao diện tạo ảnh gọi API tích hợp code so sánh 3 phương pháp:
1. Synchronous (Đồng bộ - Tuần tự / Serial)
2. Batch Processing (Xử lý theo Lô / Chunked Batching)
3. Asynchronous (Bất đồng bộ - Song song / Parallel & Concurrent)
2. KHÁI NIỆM & NGUYÊN LÝ HOẠT ĐỘNG
2.1 Synchronous (Đồng bộ - Nối tiếp)
- Nguyên lý: Các câu lệnh/gọi API được thực hiện nối tiếp (serial) nhau. Request tiếp theo chỉ được gửi đi sau khi request trước đó đã hoàn thành và trả về kết quả.
 2.2 Batch Processing (Xử lý theo Lô / Chunked Batching)
- Nguyên lý: Danh sách $N$ request được chia thành các lô nhỏ (chunk/batch) với kích thước $k$ (batch size). Tất cả $k$ request trong cùng một lô sẽ được gửi song song, sau đó chương trình chờ toàn bộ lô đó hoàn thành trước khi chuyển sang lô tiếp theo.
 2.3 Asynchronous (Bất đồng bộ Song song - Full Parallel / Concurrent)
- Nguyên lý: Tất cả N request được kích hoạt đồng thời mà không chờ đợi lẫn nhau (`Promise.all` hoặc `Promise.allSettled`). Thời gian hoàn tất chung chủ yếu phụ thuộc vào request chậm nhất (Bottleneck request).
 3. BẢNG SO SÁNH CHI TIẾT 6 TIÊU CHÍ
Số request	Phương pháp	Tổng thời gian	Throughput	Latency TB	Speedup
6	Synchronous	2.342 ms	2,56 req/s	390 ms	1,00x
	Batch Processing	976 ms	6,15 req/s	388 ms	2,40x
	Asynchronous	578 ms	10,38 req/s	431 ms	4,05x
12	Synchronous	5.456 ms	2,20 req/s	455 ms	1,00x
	Batch Processing	1.723 ms	6,96 req/s	411 ms	3,17x
	Asynchronous	484 ms	24,82 req/s	346 ms	11,27x
20	Synchronous	9.657 ms	2,07 req/s	483 ms	1,00x
	Batch Processing	2.605 ms	7,68 req/s	413 ms	3,71x
	Asynchronous	584 ms	34,28 req/s	373 ms	16,54x
 
Hình 1. Giao diện chạy đo đạc
4. KẾT LUẬN
1. Sử dụng Async cho danh sách nhỏ (N < 6): Đạt tốc độ hiển thị tức thì.
2. Sử dụng Chunked Batch / Concurrency Pool cho danh sách lớn (N > 6): Đảm bảo không làm nghẽn Event Loop trình duyệt và tuân thủ Rate Limit của API Provider.
3. Áp dụng Exponential Backoff với Jitter: Khi nhận mã lỗi `HTTP 429`, tự động hoãn request và thử lại sau thời gian tăng dần ngẫu nhiên.
4. Hiển thị Skeleton & Streaming UI: Render ảnh ngay khi từng request hoàn thành để đem lại trải nghiệm mượt mà nhất cho người dùng.


