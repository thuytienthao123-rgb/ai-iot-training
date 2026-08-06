/**
 * benchmark.js - API Call Performance Benchmarking Suite
 * So sánh 3 phương pháp gọi API: Synchronous, Batching, Asynchronous
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ApiBenchmark = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  /**
   * Giả lập một request API tạo/tải hình ảnh với độ trễ ngẫu nhiên hoặc thực hiện fetch thật
   */
  async function defaultFetchFn(prompt, index, simulateLatency = true) {
    if (!simulateLatency) {
      // Nếu có fetchFn tùy chỉnh được truyền vào
      return await fetch(`https://source.unsplash.com/random/400x300/?${encodeURIComponent(prompt)}`);
    }
    
    // Giả lập độ trễ API AI Image (250ms -> 600ms)
    const delay = Math.floor(Math.random() * 350) + 250;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Thỉnh thoảng mô phỏng tỉ lệ lỗi nhẹ 2% nếu muốn, mặc định 100% success
    return {
      id: index + 1,
      prompt,
      url: `https://picsum.photos/seed/${encodeURIComponent(prompt + index)}/400/300`,
      latency: delay,
      timestamp: Date.now(),
    };
  }

  /**
   * 1. SYNCHRONOUS BENCHMARK (Nối tiếp - Sequential)
   */
  async function runSyncBenchmark(items, fetchFn = defaultFetchFn, onProgress = null) {
    const startTime = performance.now();
    const results = [];
    const latencies = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < items.length; i++) {
      const itemStart = performance.now();
      if (onProgress) onProgress({ mode: 'sync', index: i, total: items.length, status: 'started' });

      try {
        const res = await fetchFn(items[i], i);
        const itemDuration = performance.now() - itemStart;
        latencies.push(itemDuration);
        successCount++;
        results.push({ status: 'fulfilled', value: res, latency: itemDuration });
        if (onProgress) onProgress({ mode: 'sync', index: i, total: items.length, status: 'completed', duration: itemDuration });
      } catch (err) {
        const itemDuration = performance.now() - itemStart;
        latencies.push(itemDuration);
        errorCount++;
        results.push({ status: 'rejected', reason: err, latency: itemDuration });
        if (onProgress) onProgress({ mode: 'sync', index: i, total: items.length, status: 'error', error: err });
      }
    }

    const totalTime = performance.now() - startTime;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const throughput = (items.length / (totalTime / 1000)).toFixed(2);

    return {
      mode: 'Synchronous (Tuần tự)',
      modeKey: 'sync',
      totalTimeMs: Math.round(totalTime),
      avgLatencyMs: Math.round(avgLatency),
      throughputReqSec: parseFloat(throughput),
      successCount,
      errorCount,
      totalRequests: items.length,
      results,
    };
  }

  /**
   * 2. BATCH BENCHMARK (Theo Lô - Chunked Batching)
   */
  async function runBatchBenchmark(items, fetchFn = defaultFetchFn, batchSize = 4, onProgress = null) {
    const startTime = performance.now();
    const results = [];
    const latencies = [];
    let successCount = 0;
    let errorCount = 0;

    const totalBatches = Math.ceil(items.length / batchSize);

    for (let b = 0; b < totalBatches; b++) {
      const startIdx = b * batchSize;
      const chunk = items.slice(startIdx, startIdx + batchSize);

      if (onProgress) onProgress({ mode: 'batch', batchIndex: b, totalBatches, status: 'batch_started' });

      const batchPromises = chunk.map(async (item, idxInChunk) => {
        const globalIdx = startIdx + idxInChunk;
        const itemStart = performance.now();
        if (onProgress) onProgress({ mode: 'batch', index: globalIdx, total: items.length, status: 'started' });

        try {
          const res = await fetchFn(item, globalIdx);
          const itemDuration = performance.now() - itemStart;
          latencies.push(itemDuration);
          successCount++;
          if (onProgress) onProgress({ mode: 'batch', index: globalIdx, total: items.length, status: 'completed', duration: itemDuration });
          return { status: 'fulfilled', value: res, latency: itemDuration };
        } catch (err) {
          const itemDuration = performance.now() - itemStart;
          latencies.push(itemDuration);
          errorCount++;
          if (onProgress) onProgress({ mode: 'batch', index: globalIdx, total: items.length, status: 'error', error: err });
          return { status: 'rejected', reason: err, latency: itemDuration };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const totalTime = performance.now() - startTime;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const throughput = (items.length / (totalTime / 1000)).toFixed(2);

    return {
      mode: `Batching (Lô k=${batchSize})`,
      modeKey: 'batch',
      batchSize,
      totalTimeMs: Math.round(totalTime),
      avgLatencyMs: Math.round(avgLatency),
      throughputReqSec: parseFloat(throughput),
      successCount,
      errorCount,
      totalRequests: items.length,
      results,
    };
  }

  /**
   * 3. ASYNCHRONOUS BENCHMARK (Song song - Concurrent Parallel)
   */
  async function runAsyncBenchmark(items, fetchFn = defaultFetchFn, onProgress = null) {
    const startTime = performance.now();
    const latencies = [];
    let successCount = 0;
    let errorCount = 0;

    const promises = items.map(async (item, index) => {
      const itemStart = performance.now();
      if (onProgress) onProgress({ mode: 'async', index, total: items.length, status: 'started' });

      try {
        const res = await fetchFn(item, index);
        const itemDuration = performance.now() - itemStart;
        latencies.push(itemDuration);
        successCount++;
        if (onProgress) onProgress({ mode: 'async', index, total: items.length, status: 'completed', duration: itemDuration });
        return { status: 'fulfilled', value: res, latency: itemDuration };
      } catch (err) {
        const itemDuration = performance.now() - itemStart;
        latencies.push(itemDuration);
        errorCount++;
        if (onProgress) onProgress({ mode: 'async', index, total: items.length, status: 'error', error: err });
        return { status: 'rejected', reason: err, latency: itemDuration };
      }
    });

    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const throughput = (items.length / (totalTime / 1000)).toFixed(2);

    return {
      mode: 'Asynchronous (Song song)',
      modeKey: 'async',
      totalTimeMs: Math.round(totalTime),
      avgLatencyMs: Math.round(avgLatency),
      throughputReqSec: parseFloat(throughput),
      successCount,
      errorCount,
      totalRequests: items.length,
      results,
    };
  }

  /**
   * Chạy cả 3 phương pháp và tính hệ số tăng tốc (Speedup Factor)
   */
  async function runFullComparison(prompts, fetchFn = defaultFetchFn, options = {}, onProgress = null) {
    const batchSize = options.batchSize || 4;

    const syncRes = await runSyncBenchmark(prompts, fetchFn, onProgress);
    const batchRes = await runBatchBenchmark(prompts, fetchFn, batchSize, onProgress);
    const asyncRes = await runAsyncBenchmark(prompts, fetchFn, onProgress);

    // Calculate Speedup relative to Sync
    const syncTime = syncRes.totalTimeMs || 1;
    syncRes.speedup = '1.00x';
    batchRes.speedup = (syncTime / (batchRes.totalTimeMs || 1)).toFixed(2) + 'x';
    asyncRes.speedup = (syncTime / (asyncRes.totalTimeMs || 1)).toFixed(2) + 'x';

    return {
      timestamp: new Date().toISOString(),
      promptCount: prompts.length,
      summary: [syncRes, batchRes, asyncRes],
      sync: syncRes,
      batch: batchRes,
      async: asyncRes,
    };
  }

  return {
    runSyncBenchmark,
    runBatchBenchmark,
    runAsyncBenchmark,
    runFullComparison,
    defaultFetchFn,
  };
}));
