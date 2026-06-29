/**
 * IP adresi doğrulama yardımcıları.
 * Node.js'in yerleşik 'net' modülünü kullanarak IPv4 ve IPv6 desteği sağlar.
 */

const net = require('net');

/**
 * Verilen metnin geçerli bir IPv4 veya IPv6 adresi olup olmadığını kontrol eder.
 * @param {string} ip - Kontrol edilecek IP adresi
 * @returns {boolean} Geçerliyse true, değilse false
 */
function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') {
    return false;
  }

  const trimmed = ip.trim();

  // net.isIP: 0 = geçersiz, 4 = IPv4, 6 = IPv6
  return net.isIP(trimmed) !== 0;
}

/**
 * IP adresini sorgulama için normalize eder (başındaki/sonundaki boşlukları temizler).
 * @param {string} ip - Ham IP girişi
 * @returns {string} Temizlenmiş IP adresi
 */
function normalizeIp(ip) {
  return ip.trim();
}

module.exports = {
  isValidIp,
  normalizeIp,
};
