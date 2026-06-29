/**
 * AlienVault OTX (Open Threat Exchange) entegrasyonu.
 * Dokümantasyon: https://otx.alienvault.com/api
 *
 * OTX_API_KEY .env dosyasında yoksa hiçbir şeyi bozmadan
 * { available: false, error: 'Yapılandırılmadı' } döndürür.
 */

const OTX_BASE = 'https://otx.alienvault.com/api/v1/indicators';

/**
 * AlienVault OTX'ten IP itibar bilgisi çeker.
 * @param {string} ipAddress - Sorgulanacak IPv4 veya IPv6 adresi
 * @param {string} apiKey    - OTX API anahtarı
 * @returns {Promise<object>} OTX sonuç objesi (hata durumunda available: false)
 */
async function checkIpOtx(ipAddress, apiKey) {
  const type = ipAddress.includes(':') ? 'IPv6' : 'IPv4';
  const url = `${OTX_BASE}/${type}/${encodeURIComponent(ipAddress)}/general`;

  let response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-OTX-API-KEY': apiKey,
        Accept: 'application/json',
      },
    });
  } catch {
    return { available: false, error: 'OTX servisine bağlanılamadı' };
  }

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      return { available: false, error: 'OTX API anahtarı geçersiz' };
    }
    return { available: false, error: `OTX API hatası (HTTP ${response.status})` };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { available: false, error: 'OTX yanıtı okunamadı' };
  }

  return {
    available: true,
    pulseCount: data.pulse_info?.count ?? 0,
    reputation: data.reputation ?? 0,
    malwareCount: data.malware_families?.length ?? 0,
    urlCount: data.url_list?.length ?? 0,
  };
}

module.exports = { checkIpOtx };
