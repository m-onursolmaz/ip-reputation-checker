/**
 * VirusTotal API v3 entegrasyonu.
 * Dokümantasyon: https://developers.virustotal.com/reference/ip-info
 *
 * VT_API_KEY .env dosyasında yoksa hiçbir şeyi bozmadan
 * { available: false, error: 'Yapılandırılmadı' } döndürür.
 */

const VT_BASE = 'https://www.virustotal.com/api/v3/ip_addresses';

/**
 * VirusTotal'dan IP itibar analizi çeker.
 * @param {string} ipAddress - Sorgulanacak IPv4 veya IPv6 adresi
 * @param {string} apiKey    - VirusTotal API anahtarı
 * @returns {Promise<object>} VT sonuç objesi (hata durumunda available: false)
 */
async function checkIpVirusTotal(ipAddress, apiKey) {
  const url = `${VT_BASE}/${encodeURIComponent(ipAddress)}`;

  let response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apikey': apiKey,
        Accept: 'application/json',
      },
    });
  } catch {
    return { available: false, error: 'VirusTotal servisine bağlanılamadı' };
  }

  if (response.status === 401 || response.status === 403) {
    return { available: false, error: 'VT API anahtarı geçersiz' };
  }

  if (response.status === 429) {
    return { available: false, error: 'VT istek limiti aşıldı' };
  }

  if (!response.ok) {
    return { available: false, error: `VirusTotal API hatası (HTTP ${response.status})` };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { available: false, error: 'VirusTotal yanıtı okunamadı' };
  }

  const stats = data?.data?.attributes?.last_analysis_stats ?? {};

  return {
    available: true,
    malicious: stats.malicious ?? 0,
    suspicious: stats.suspicious ?? 0,
    harmless: stats.harmless ?? 0,
    undetected: stats.undetected ?? 0,
  };
}

module.exports = { checkIpVirusTotal };
