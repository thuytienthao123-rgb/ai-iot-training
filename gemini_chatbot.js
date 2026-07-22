/**
 * gemini_chatbot.js
 * Script Chatbot đơn giản kết nối Gemini API
 * Tính năng: Parse response, Xử lý lỗi (Error handling), Retry logic (Exponential Backoff)
 */

class GeminiChatbot {
  /**
   * @param {string} apiKey Gemini API Key (lấy từ Google AI Studio)
   * @param {string} model Tên model (mặc định gemini-1.5-flash)
   */
  constructor(apiKey, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  /**
   * Tự động tạm dừng (sleep) cho retry logic
   * @param {number} ms Milliseconds
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gọi Gemini API với Retry Logic & Error Handling
   * @param {string} prompt Câu hỏi / Yêu cầu gửi tới Gemini
   * @param {number} maxRetries Số lần thử lại tối đa (Mặc định 3 lần)
   * @param {number} baseDelayMs Delay khởi điểm cho Exponential Backoff (1000ms = 1s)
   */
  async sendMessage(prompt, maxRetries = 3, baseDelayMs = 1000) {
    if (!this.apiKey) {
      throw new Error('CONFIG_ERROR: Chưa cấu hình Gemini API Key.');
    }
    if (!prompt || !prompt.trim()) {
      throw new Error('INVALID_INPUT: Nội dung prompt không được để trống.');
    }

    const endpoint = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800
      }
    };

    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      try {
        console.log(`📡 [Attempt ${attempt}/${maxRetries + 1}] Gửi request đến Gemini API...`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // 1. Xử lý HTTP Error Code
        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          const errorMsg = errorJson?.error?.message || `HTTP status ${response.status}`;

          // Phân loại lỗi
          if (response.status === 401 || response.status === 403) {
            throw new Error(`AUTHENTICATION_ERROR (401/403): API Key không hợp lệ. (${errorMsg})`);
          } else if (response.status === 404) {
            throw new Error(`MODEL_NOT_FOUND (404): Model "${this.model}" không tồn tại.`);
          } else if (response.status === 429) {
            console.warn(`⚠️ Rate Limit Exceeded (429). Sẽ thử lại sau...`);
          } else if (response.status >= 500) {
            console.warn(`⚠️ Lỗi từ Server Gemini (${response.status}). Sẽ thử lại sau...`);
          } else {
            throw new Error(`API_ERROR (${response.status}): ${errorMsg}`);
          }
        } else {
          // 2. Parse Response JSON thành công
          const data = await response.json();
          return this._parseResponse(data);
        }
      } catch (error) {
        // Lỗi không thể retry (chẳng hạn sai API key hoặc sai tham số)
        if (error.message.startsWith('AUTHENTICATION_ERROR') || 
            error.message.startsWith('MODEL_NOT_FOUND') || 
            error.message.startsWith('CONFIG_ERROR') ||
            error.message.startsWith('INVALID_INPUT')) {
          throw error;
        }

        // Đã hết số lần retry
        if (attempt > maxRetries) {
          throw new Error(`RETRY_FAILED: Gửi tin nhắn thất bại sau ${maxRetries + 1} lần thử. Chi tiết: ${error.message}`);
        }

        // Exponential Backoff Delay: 1s -> 2s -> 4s
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`⏳ [Retry Logic] Thử lại lần thứ ${attempt} sau ${delay}ms...`);
        await this._sleep(delay);
      }
    }
  }

  /**
   * Trích xuất câu trả lời text sạch từ Gemini response payload
   */
  _parseResponse(data) {
    try {
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error('PARSING_ERROR: Không tìm thấy ứng viên câu trả lời (candidates) trong response.');
      }

      // Kiểm tra finishReason
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.warn(`⚠️ Cảnh báo finishReason: ${candidate.finishReason}`);
      }

      const text = candidate.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('PARSING_ERROR: Không tìm thấy nội dung văn bản (parts[0].text).');
      }

      return {
        success: true,
        reply: text.trim(),
        finishReason: candidate.finishReason,
        usage: data.usageMetadata || null
      };
    } catch (err) {
      throw new Error(`RESPONSE_PARSING_FAILED: ${err.message}`);
    }
  }
}

// Export cho Browser / Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GeminiChatbot };
}
