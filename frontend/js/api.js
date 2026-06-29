/**
 * Backend API ile iletişim katmanı.
 * fetch() kullanarak POST /check endpoint'ine istek gönderir.
 */

const API_CHECK_URL = '/check';

/**
 * Kullanıcı dostu hata mesajları (backend kodlarına göre).
 * Backend'den gelmeyen durumlar için varsayılan mesajlar da tanımlı.
 */
const ERROR_MESSAGES = {
  EMPTY_IP: 'Lütfen bir IP adresi girin.',
  INVALID_IP: 'Geçersiz IP adresi. Lütfen geçerli bir IPv4 veya IPv6 adresi girin.',
  MISSING_API_KEY: 'Sunucuda API anahtarı yapılandırılmamış. Yönetici .env dosyasını kontrol etmeli.',
  RATE_LIMIT: 'API istek limiti aşıldı. Lütfen bir süre sonra tekrar deneyin.',
  NETWORK_ERROR: 'Sunucuya bağlanılamadı. İnternet bağlantınızı ve sunucunun çalıştığını kontrol edin.',
  INVALID_API_KEY: 'API anahtarı geçersiz. Sunucu yapılandırmasını kontrol edin.',
  API_ERROR: 'Harici API hatası oluştu. Lütfen daha sonra tekrar deneyin.',
  UNKNOWN_ERROR: 'Beklenmeyen bir hata oluştu.',
};

/**
 * IP itibar sorgusu gönderir.
 * @param {string} ip - Sorgulanacak IP adresi
 * @returns {Promise<object>} Başarılı yanıtta data objesi
 * @throws {Error} Hata durumunda message ve code içeren Error
 */
async function checkIp(ip) {
  let response;

  try {
    response = await fetch(API_CHECK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ip: ip.trim() }),
    });
  } catch {
    // fetch başarısız: ağ kesintisi, sunucu kapalı, CORS vb.
    const error = new Error(ERROR_MESSAGES.NETWORK_ERROR);
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  // Yanıt gövdesini JSON olarak oku
  let payload;
  try {
    payload = await response.json();
  } catch {
    const error = new Error(ERROR_MESSAGES.NETWORK_ERROR);
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  // Backend hata yanıtı
  if (!response.ok || !payload.success) {
    const code = payload.error?.code || 'UNKNOWN_ERROR';
    const message =
      payload.error?.message ||
      ERROR_MESSAGES[code] ||
      ERROR_MESSAGES.UNKNOWN_ERROR;

    const error = new Error(message);
    error.code = code;
    throw error;
  }

  return payload.data;
}

// Global scope'a ekle
window.IpApi = {
  checkIp,
  ERROR_MESSAGES,
};
