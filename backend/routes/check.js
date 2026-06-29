/**
 * /check endpoint route tanımı.
 * Frontend'den gelen IP sorgularını alır, doğrular ve AbuseIPDB'ye iletir.
 */

const express = require('express');
const { isValidIp, normalizeIp } = require('../utils/ipValidator');
const { getRiskLevel } = require('../utils/riskLevel');
const { checkIpReputation } = require('../services/abuseIpDb');
const { checkIpOtx } = require('../services/otx');
const { checkIpVirusTotal } = require('../services/virustotal');

const router = express.Router();

/**
 * POST /check
 * Body: { "ip": "8.8.8.8" }
 *
 * Başarılı yanıt örneği:
 * {
 *   "success": true,
 *   "data": {
 *     "ipAddress": "8.8.8.8",
 *     "abuseConfidenceScore": 0,
 *     "countryCode": "US",
 *     "isp": "...",
 *     "domain": "...",
 *     "totalReports": 0,
 *     "lastReportedAt": null,
 *     "riskLevel": { "level": "clean", "label": "Temiz" }
 *   }
 * }
 */
router.post('/', async (req, res) => {
  const rawIp = req.body?.ip;

  // Boş IP kontrolü
  if (!rawIp || typeof rawIp !== 'string' || rawIp.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'EMPTY_IP',
        message: 'Lütfen bir IP adresi girin.',
      },
    });
  }

  const ip = normalizeIp(rawIp);

  // Geçersiz IP formatı kontrolü
  if (!isValidIp(ip)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_IP',
        message: 'Geçersiz IP adresi. Lütfen geçerli bir IPv4 veya IPv6 adresi girin.',
      },
    });
  }

  // API anahtarı .env dosyasından okunur
  const apiKey = process.env.ABUSEIPDB_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
    return res.status(500).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message:
          'Sunucuda API anahtarı yapılandırılmamış. backend/.env dosyasına ABUSEIPDB_API_KEY ekleyin.',
      },
    });
  }

  try {
    const result = await checkIpReputation(ip, apiKey.trim());
    const riskLevel = getRiskLevel(result.abuseConfidenceScore);

    // OTX opsiyonel: key yoksa veya hata olursa AbuseIPDB sonucunu bozmaz
    const otxApiKey = process.env.OTX_API_KEY;
    let otx;
    if (otxApiKey && otxApiKey.trim() !== '' && otxApiKey !== 'your_otx_api_key_here') {
      otx = await checkIpOtx(ip, otxApiKey.trim());
    } else {
      otx = { available: false, error: 'Yapılandırılmadı' };
    }

    // VirusTotal opsiyonel: key yoksa veya hata olursa AbuseIPDB sonucunu bozmaz
    const vtApiKey = process.env.VT_API_KEY;
    let virustotal;
    if (vtApiKey && vtApiKey.trim() !== '' && vtApiKey !== 'your_virustotal_api_key_here') {
      virustotal = await checkIpVirusTotal(ip, vtApiKey.trim());
    } else {
      virustotal = { available: false, error: 'Yapılandırılmadı' };
    }

    return res.json({
      success: true,
      data: {
        ...result,
        riskLevel,
        otx,
        virustotal,
      },
    });
  } catch (error) {
    // Bilinen hata kodlarına göre uygun HTTP durum kodu seç
    const statusByCode = {
      RATE_LIMIT: 429,
      INVALID_API_KEY: 500,
      NETWORK_ERROR: 503,
      API_ERROR: 502,
    };

    const status = statusByCode[error.code] || 500;

    return res.status(status).json({
      success: false,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Beklenmeyen bir hata oluştu.',
      },
    });
  }
});

module.exports = router;
