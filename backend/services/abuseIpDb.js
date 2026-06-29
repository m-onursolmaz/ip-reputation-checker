/**
 * AbuseIPDB API v2 entegrasyonu.
 * Dokümantasyon: https://docs.abuseipdb.com/
 */

const ABUSEIPDB_CHECK_URL = 'https://api.abuseipdb.com/api/v2/check';

/**
 * AbuseIPDB API'sine IP sorgusu gönderir ve sonucu normalize eder.
 * @param {string} ipAddress - Sorgulanacak IPv4 veya IPv6 adresi
 * @param {string} apiKey - AbuseIPDB API anahtarı
 * @returns {Promise<object>} Normalize edilmiş IP itibar bilgileri
 * @throws {Error} API veya ağ hatalarında anlaşılır mesajlı hata fırlatır
 */
async function checkIpReputation(ipAddress, apiKey) {
  // IPv6 adreslerindeki ':' karakterleri URL'de encode edilmelidir
  const queryParams = new URLSearchParams({
    ipAddress,
    maxAgeInDays: '90',
  });

  const url = `${ABUSEIPDB_CHECK_URL}?${queryParams.toString()}`;

  let response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Key: apiKey,
      },
    });
  } catch (error) {
    // DNS, bağlantı veya zaman aşımı gibi ağ katmanı hataları
    const networkError = new Error(
      'AbuseIPDB servisine bağlanılamadı. İnternet bağlantınızı kontrol edin.'
    );
    networkError.code = 'NETWORK_ERROR';
    networkError.cause = error;
    throw networkError;
  }

  // Yanıt gövdesini JSON olarak okumaya çalış
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  // HTTP 429: Günlük/saatlik istek limiti aşıldı
  if (response.status === 429) {
    const rateLimitError = new Error(
      'API istek limiti aşıldı. Lütfen bir süre sonra tekrar deneyin.'
    );
    rateLimitError.code = 'RATE_LIMIT';
    throw rateLimitError;
  }

  // HTTP 401/403: Geçersiz veya yetkisiz API anahtarı
  if (response.status === 401 || response.status === 403) {
    const authError = new Error(
      'API anahtarı geçersiz veya yetkisiz. .env dosyasındaki ABUSEIPDB_API_KEY değerini kontrol edin.'
    );
    authError.code = 'INVALID_API_KEY';
    throw authError;
  }

  // Diğer başarısız HTTP durum kodları
  if (!response.ok) {
    const apiMessage =
      payload?.errors?.[0]?.detail ||
      payload?.errors?.[0]?.title ||
      `AbuseIPDB API hatası (HTTP ${response.status}).`;

    const apiError = new Error(apiMessage);
    apiError.code = 'API_ERROR';
    apiError.status = response.status;
    throw apiError;
  }

  const data = payload?.data;

  if (!data) {
    const emptyError = new Error('AbuseIPDB yanıtı beklenen formatta değil.');
    emptyError.code = 'API_ERROR';
    throw emptyError;
  }

  // Frontend'in ihtiyaç duyduğu alanları tek bir yapıda döndür
  return {
    ipAddress: data.ipAddress ?? ipAddress,
    abuseConfidenceScore: data.abuseConfidenceScore ?? 0,
    countryCode: data.countryCode ?? 'N/A',
    isp: data.isp ?? 'Bilinmiyor',
    domain: data.domain ?? 'N/A',
    totalReports: data.totalReports ?? 0,
    lastReportedAt: data.lastReportedAt ?? null,
  };
}

module.exports = { checkIpReputation };
