/**
 * LocalStorage ile son sorgulanan IP adreslerini yönetir.
 * En fazla 10 kayıt saklanır (en yeni en üstte).
 */

const HISTORY_STORAGE_KEY = 'ipReputationHistory';
const STATS_STORAGE_KEY = 'ipReputationStats';
const MAX_HISTORY_ITEMS = 10;
const MAX_STATS_ITEMS = 50;

/**
 * LocalStorage'dan geçmiş IP listesini okur.
 * @returns {string[]} IP adresleri dizisi (en yeni önce)
 */
function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Bozuk veri durumunda boş dizi döndür
    return [];
  }
}

/**
 * Yeni bir IP'yi geçmişe ekler.
 * Aynı IP tekrar sorgulanırsa en üste taşınır.
 * @param {string} ip - Kaydedilecek IP adresi
 */
function addToHistory(ip) {
  const trimmed = ip.trim();
  if (!trimmed) return;

  // Mevcut listeden aynı IP'yi çıkar (tekrar eklememek için)
  const filtered = getHistory().filter((item) => item !== trimmed);
  const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS);

  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Geçmiş listesini DOM'a render eder.
 * @param {HTMLElement} listElement - <ul> elementi
 * @param {HTMLElement} emptyElement - Boş durum mesajı elementi
 * @param {(ip: string) => void} onSelect - IP'ye tıklandığında çağrılacak fonksiyon
 */
function renderHistory(listElement, emptyElement, onSelect) {
  const history = getHistory();

  // Listeyi temizle
  listElement.innerHTML = '';

  if (history.length === 0) {
    emptyElement.hidden = false;
    return;
  }

  emptyElement.hidden = true;

  history.forEach((ip) => {
    const li = document.createElement('li');
    li.className = 'history-list__item';
    li.setAttribute('role', 'listitem');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-list__btn';
    button.textContent = ip;
    button.title = `${ip} adresini tekrar sorgula`;

    // Geçmişten seçilen IP ile formu doldur ve sorgula
    button.addEventListener('click', () => onSelect(ip));

    li.appendChild(button);
    listElement.appendChild(li);
  });
}

/**
 * LocalStorage'dan kayıtlı sorgu sonuçlarını okur.
 * Dashboard ve tablo bu veriyi kullanır.
 * @returns {object[]} Sorgu sonuçları (en yeni önce)
 */
function getQueryResults() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Başarılı bir sorgu sonucunu istatistikler için kaydeder.
 * @param {object} data - Backend'den gelen sonuç objesi
 */
function addQueryResult(data) {
  if (!data?.ipAddress) return;

  const entry = {
    ipAddress: data.ipAddress,
    abuseConfidenceScore: data.abuseConfidenceScore ?? 0,
    countryCode: data.countryCode ?? 'N/A',
    isp: data.isp ?? 'Bilinmiyor',
    domain: data.domain ?? 'N/A',
    totalReports: data.totalReports ?? 0,
    lastReportedAt: data.lastReportedAt ?? null,
    riskLevel: data.riskLevel ?? { level: 'unknown', label: 'Bilinmiyor' },
    queriedAt: new Date().toISOString(),
  };

  const updated = [entry, ...getQueryResults()].slice(0, MAX_STATS_ITEMS);
  localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Dashboard kartları için özet istatistikleri hesaplar.
 * @returns {object} Toplam sorgu, risk dağılımı ve son IP
 */
function getDashboardStats() {
  const results = getQueryResults();
  const history = getHistory();

  const countByLevel = (level) =>
    results.filter((item) => item.riskLevel?.level === level).length;

  return {
    totalQueries: results.length,
    clean: countByLevel('clean'),
    low: countByLevel('low'),
    medium: countByLevel('medium'),
    high: countByLevel('high'),
    lastIp: history[0] || results[0]?.ipAddress || '—',
  };
}

// Diğer modüllerin kullanması için global scope'a ekle
window.IpHistory = {
  getHistory,
  addToHistory,
  renderHistory,
  getQueryResults,
  addQueryResult,
  getDashboardStats,
};
