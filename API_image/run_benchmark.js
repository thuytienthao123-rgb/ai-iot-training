/**
 * run_benchmark.js - Standalone CLI Benchmark Runner
 * Chạy bài đo kiểm hiệu năng 3 mô hình gọi API (Synchronous, Batch, Async) trên môi trường Node.js
 */

const ApiBenchmark = require('./benchmark.js');

// Danh sách các câu prompt giả lập tạo/tải hình ảnh AI
const SAMPLE_PROMPTS = [
  'Hoàng hôn rực rỡ trên biển Da Nang',
  'Phong cảnh mùa thu lá vàng Kyoto Nhật Bản',
  'Thành phố tương lai Cyberpunk rực rỡ đèn neon',
  'Mèo con ngây thơ chơi với cuộn len',
  'Cánh đồng hoa hướng dương nở rộ dưới nắng hè',
  'Chú rồng thần thoại bay qua đỉnh núi tuyết',
  'Tách cà phê Latte Art tỏa khói nghi ngút',
  'Rừng thông Đà Lạt mờ sương buổi sáng',
  'Phi hành tử lơ lửng ngoài vũ trụ dải ngân hà',
  'Lâu đài cổ kính Châu Âu mùa đông tuyết phủ',
  'Robot AI làm bếp vui nhộn',
  'Tranh sơn dầu phong cảnh làng quê Việt Nam'
];

async function main() {
  console.log('================================================================');
  console.log(' ⚡ API CALL PERFORMANCE BENCHMARK SUITE (Node.js CLI Runner)');
  console.log(' So sánh: Synchronous (Nối tiếp) vs Batching vs Asynchronous (Song song)');
  console.log('================================================================\n');

  console.log(`📌 Khởi chạy đo kiểm với ${SAMPLE_PROMPTS.length} requests bài test...`);
  console.log('⌛ Vui lòng chờ trong giây lát...\n');

  let currentMode = '';
  const progressCallback = (evt) => {
    if (evt.mode !== currentMode) {
      currentMode = evt.mode;
      console.log(`\n▶️ Đang thực thi chế độ: ${evt.mode.toUpperCase()}`);
    }
  };

  const results = await ApiBenchmark.runFullComparison(
    SAMPLE_PROMPTS,
    ApiBenchmark.defaultFetchFn,
    { batchSize: 4 },
    progressCallback
  );

  console.log('\n\n================================================================');
  console.log(' 📊 BẢNG KẾT QUẢ BENCHMARK DỮ LIỆU THỰC NGHIỆM');
  console.log('================================================================');

  const tableData = results.summary.map(item => ({
    'Mô hình gọi API': item.mode,
    'Tổng thời gian (ms)': `${item.totalTimeMs} ms`,
    'Tốc độ (Req/sec)': `${item.throughputReqSec} req/s`,
    'Độ trễ trung bình': `${item.avgLatencyMs} ms`,
    'Thành công': `${item.successCount}/${item.totalRequests}`,
    'Hệ số Tăng tốc': item.speedup
  }));

  console.table(tableData);

  console.log('\n💡 ĐÁNH GIÁ & KẾT LUẬN:');
  console.log(`- Mode ASYNC đạt tốc độ cao nhất (${results.async.throughputReqSec} req/s), nhanh gấp ${results.async.speedup} so với SYNC.`);
  console.log(`- Mode BATCH đạt tốc độ khá (${results.batch.throughputReqSec} req/s), nhanh gấp ${results.batch.speedup} so với SYNC và bảo vệ Rate Limit tốt hơn.`);
  console.log(`- Mode SYNC tốn nhiều thời gian nhất (${results.sync.totalTimeMs} ms) do cản trở bởi luồng nối tiếp.`);
  console.log('================================================================\n');
}

main().catch(err => console.error('Lỗi khi chạy benchmark:', err));
