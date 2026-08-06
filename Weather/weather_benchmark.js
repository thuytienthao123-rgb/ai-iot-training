/**
 * weather_benchmark.js
 * Script gọi API Thời tiết + Caching + Benchmark 100 Requests
 * Tiêu chí bài tập: Áp dụng & Đo Metrics (2 tuần)
 */

class WeatherCache {
  constructor(ttlMs = 10 * 60 * 1000) { // Mặc định cache 10 phút
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  _getKey(city, units) {
    return `${city.trim().toLowerCase()}_${units}`;
  }

  get(city, units = 'metric') {
    const key = this._getKey(city, units);
    const item = this.cache.get(key);
    if (!item) return null;

    // Kiểm tra hết hạn TTL
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(city, data, units = 'metric') {
    const key = this._getKey(city, units);
    this.cache.set(key, {
      data: data,
      expiry: Date.now() + this.ttlMs
    });
  }

  clear() {
    this.cache.clear();
  }
}

class WeatherService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
    this.cache = new WeatherCache();
  }

  /**
   * Gọi API thời tiết có áp dụng Cache
   */
  async fetchWeatherCached(city, units = 'metric') {
    const cachedData = this.cache.get(city, units);
    if (cachedData) {
      return { data: cachedData, fromCache: true };
    }

    const url = `${this.baseUrl}/weather?q=${encodeURIComponent(city)}&units=${units}&lang=vi&appid=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();

    this.cache.set(city, data, units);
    return { data, fromCache: false };
  }

  /**
   * Gọi API thời tiết KHÔNG dùng Cache (gửi request mới hoàn toàn)
   */
  async fetchWeatherUncached(city, units = 'metric') {
    const url = `${this.baseUrl}/weather?q=${encodeURIComponent(city)}&units=${units}&lang=vi&appid=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    return { data, fromCache: false };
  }

  /**
   * Chạy Benchmark với 100 requests
   * @param {string} city 
   * @param {number} totalRequests (mặc định 100)
   */
  async runBenchmark(city = 'Hanoi', totalRequests = 100) {
    console.log(`🚀 Bắt đầu Benchmark: ${totalRequests} requests cho thành phố "${city}"...\n`);

    // 1. Benchmark KHÔNG Cache
    console.log('⏳ 1. Đang chạy 100 requests KHÔNG Cache...');
    const uncachedTimes = [];
    const startTimeUncached = performance.now();

    for (let i = 0; i < totalRequests; i++) {
      const start = performance.now();
      try {
        await this.fetchWeatherUncached(city);
        const duration = performance.now() - start;
        uncachedTimes.push(duration);
      } catch (err) {
        console.error(`  x Request ${i + 1} thất bại:`, err.message);
      }
    }
    const totalTimeUncached = performance.now() - startTimeUncached;
    const avgUncached = uncachedTimes.reduce((a, b) => a + b, 0) / uncachedTimes.length;
    const minUncached = Math.min(...uncachedTimes);
    const maxUncached = Math.max(...uncachedTimes);

    // Reset Cache trước khi test có Cache
    this.cache.clear();

    // 2. Benchmark CÓ Cache
    console.log('⚡ 2. Đang chạy 100 requests CÓ Cache...');
    const cachedTimes = [];
    let cacheHits = 0;
    const startTimeCached = performance.now();

    for (let i = 0; i < totalRequests; i++) {
      const start = performance.now();
      try {
        const res = await this.fetchWeatherCached(city);
        if (res.fromCache) cacheHits++;
        const duration = performance.now() - start;
        cachedTimes.push(duration);
      } catch (err) {
        console.error(`  x Request ${i + 1} thất bại:`, err.message);
      }
    }
    const totalTimeCached = performance.now() - startTimeCached;
    const avgCached = cachedTimes.reduce((a, b) => a + b, 0) / cachedTimes.length;
    const minCached = Math.min(...cachedTimes);
    const maxCached = Math.max(...cachedTimes);

    // 3. Tính toán Metrics
    const speedupFactor = (avgUncached / avgCached).toFixed(2);
    const hitRatePercent = ((cacheHits / totalRequests) * 100).toFixed(1);
    const timeSavedMs = (totalTimeUncached - totalTimeCached).toFixed(2);

    const report = {
      city,
      totalRequests,
      uncached: {
        totalTimeMs: totalTimeUncached.toFixed(2),
        avgTimeMs: avgUncached.toFixed(2),
        minTimeMs: minUncached.toFixed(2),
        maxTimeMs: maxUncached.toFixed(2)
      },
      cached: {
        totalTimeMs: totalTimeCached.toFixed(2),
        avgTimeMs: avgCached.toFixed(2),
        minTimeMs: minCached.toFixed(2),
        maxTimeMs: maxCached.toFixed(2),
        hitRate: `${hitRatePercent}%`
      },
      metrics: {
        speedupFactor: `${speedupFactor}x`,
        timeSavedMs: `${timeSavedMs} ms`,
        efficiencyImprovement: `${(((avgUncached - avgCached) / avgUncached) * 100).toFixed(2)}%`
      }
    };

    console.log('\n================ BÁO CÁO KẾT QUẢ BENCHMARK ================');
    console.table({
      'Không Cache': {
        'Tổng thời gian (ms)': report.uncached.totalTimeMs,
        'Trung bình (ms)': report.uncached.avgTimeMs,
        'Min (ms)': report.uncached.minTimeMs,
        'Max (ms)': report.uncached.maxTimeMs,
        'Hit Rate': 'N/A'
      },
      'Có Cache': {
        'Tổng thời gian (ms)': report.cached.totalTimeMs,
        'Trung bình (ms)': report.cached.avgTimeMs,
        'Min (ms)': report.cached.minTimeMs,
        'Max (ms)': report.cached.maxTimeMs,
        'Hit Rate': report.cached.hitRate
      }
    });

    console.log(`\n🎯 ĐÁNH GIÁ HIỆU NĂNG:`);
    console.log(`- Tốc độ xử lý nhanh hơn: ${report.metrics.speedupFactor}`);
    console.log(`- Thời gian tiết kiệm được: ${report.metrics.timeSavedMs}`);
    console.log(`- Tỉ lệ tối ưu latency: ${report.metrics.efficiencyImprovement}`);
    console.log('===========================================================\n');

    return report;
  }
}

// Export cho Browser / Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeatherCache, WeatherService };
}
