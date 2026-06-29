/**
 * Abuse Confidence Score değerine göre risk seviyesi hesaplama.
 *
 * Skor aralıkları:
 *   0        → Temiz
 *   1–25     → Düşük Risk
 *   26–75    → Orta Risk
 *   76–100   → Yüksek Risk
 */

/**
 * AbuseIPDB güven skorundan kullanıcı dostu risk etiketi üretir.
 * @param {number} score - 0 ile 100 arası abuse confidence score
 * @returns {{ level: string, label: string }} Risk seviyesi kodu ve Türkçe etiket
 */
function getRiskLevel(score) {
  const normalizedScore = Number(score);

  if (Number.isNaN(normalizedScore) || normalizedScore < 0) {
    return { level: 'unknown', label: 'Bilinmiyor' };
  }

  if (normalizedScore === 0) {
    return { level: 'clean', label: 'Temiz' };
  }

  if (normalizedScore <= 25) {
    return { level: 'low', label: 'Düşük Risk' };
  }

  if (normalizedScore <= 75) {
    return { level: 'medium', label: 'Orta Risk' };
  }

  return { level: 'high', label: 'Yüksek Risk' };
}

module.exports = { getRiskLevel };
