/**
 * Ana uygulama mantığı.
 * Form işlemleri, sonuç gösterimi ve geçmiş yönetimini bir araya getirir.
 */

(function initApp() {
  // DOM referansları
  const form = document.getElementById('check-form');
  const ipInput = document.getElementById('ip-input');
  const submitBtn = document.getElementById('submit-btn');
  const errorAlert = document.getElementById('error-alert');
  const resultsSection = document.getElementById('results-section');
  const resultsGrid = document.getElementById('results-grid');
  const riskBadge = document.getElementById('risk-badge');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');

  /**
   * Basit IPv4/IPv6 doğrulama (frontend tarafında erken uyarı için).
   * Kesin doğrulama backend'de yapılır.
   */
  function isValidIpFormat(ip) {
    const trimmed = ip.trim();
    if (!trimmed) return false;

    // IPv4: 0.0.0.0 - 255.255.255.255
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;

    // IPv6: basitleştirilmiş format kontrolü (tam RFC uyumu backend'de)
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}\d){0,1}\d)\.){3}(25[0-5]|(2[0-4]|1{0,1}\d){0,1}\d)|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}\d){0,1}\d)\.){3}(25[0-5]|(2[0-4]|1{0,1}\d){0,1}\d))$/;

    return ipv4Regex.test(trimmed) || ipv6Regex.test(trimmed);
  }

  /** Hata mesajını gösterir */
  function showError(message) {
    errorAlert.textContent = message;
    errorAlert.hidden = false;
  }

  /** Hata mesajını gizler */
  function hideError() {
    errorAlert.hidden = true;
    errorAlert.textContent = '';
  }

  /** Yükleniyor durumunu aç/kapat */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    ipInput.disabled = isLoading;
    submitBtn.classList.toggle('is-loading', isLoading);
    submitBtn.querySelector('.btn__loader').hidden = !isLoading;
  }

  /**
   * ISO tarihini okunabilir Türkçe formata çevirir.
   * @param {string|null} isoDate - ISO 8601 tarih string'i
   * @returns {string} Formatlanmış tarih veya "Hiç raporlanmadı"
   */
  function formatDate(isoDate) {
    if (!isoDate) {
      return 'Hiç raporlanmadı';
    }

    try {
      return new Date(isoDate).toLocaleString('tr-TR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoDate;
    }
  }

  /**
   * Sonuç kartındaki tek bir satırı oluşturur.
   */
  function createResultRow(label, value, isMono = false) {
    const row = document.createElement('div');
    row.className = 'results-grid__row';

    const dt = document.createElement('dt');
    dt.className = 'results-grid__label';
    dt.textContent = label;

    const dd = document.createElement('dd');
    dd.className = 'results-grid__value' + (isMono ? ' results-grid__value--mono' : '');
    dd.textContent = value ?? '—';

    row.appendChild(dt);
    row.appendChild(dd);
    return row;
  }

  /**
   * Sorgu sonuçlarını ekranda gösterir.
   * @param {object} data - Backend'den gelen data objesi
   */
  function renderResults(data) {
    // Risk rozeti
    const riskClass = `risk-badge--${data.riskLevel?.level || 'unknown'}`;
    riskBadge.className = `risk-badge ${riskClass}`;
    riskBadge.textContent = `Risk: ${data.riskLevel?.label || 'Bilinmiyor'} (Skor: ${data.abuseConfidenceScore})`;

    // Sonuç tablosunu doldur
    resultsGrid.innerHTML = '';

    const rows = [
      { label: 'IP Address', value: data.ipAddress, mono: true },
      { label: 'Abuse Confidence Score', value: String(data.abuseConfidenceScore) },
      { label: 'Country Code', value: data.countryCode },
      { label: 'ISP', value: data.isp },
      { label: 'Domain', value: data.domain },
      { label: 'Total Reports', value: String(data.totalReports) },
      { label: 'Last Reported At', value: formatDate(data.lastReportedAt) },
      { label: 'Risk Level', value: data.riskLevel?.label || 'Bilinmiyor' },
    ];

    rows.forEach(({ label, value, mono }) => {
      resultsGrid.appendChild(createResultRow(label, value, mono));
    });

    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * IP sorgusu yapar (form gönderimi veya geçmişten seçim).
   * @param {string} ip - Sorgulanacak IP
   */
  async function performCheck(ip) {
    hideError();

    const trimmed = ip.trim();

    // Boş IP kontrolü (frontend)
    if (!trimmed) {
      showError(window.IpApi.ERROR_MESSAGES.EMPTY_IP);
      ipInput.focus();
      return;
    }

    // Geçersiz IP kontrolü (frontend - erken uyarı)
    if (!isValidIpFormat(trimmed)) {
      showError(window.IpApi.ERROR_MESSAGES.INVALID_IP);
      ipInput.focus();
      return;
    }

    setLoading(true);

    try {
      const data = await window.IpApi.checkIp(trimmed);
      renderResults(data);

      // Başarılı sorguyu geçmişe kaydet
      window.IpHistory.addToHistory(trimmed);
      window.IpHistory.renderHistory(historyList, historyEmpty, (selectedIp) => {
        ipInput.value = selectedIp;
        performCheck(selectedIp);
      });
    } catch (error) {
      showError(error.message || window.IpApi.ERROR_MESSAGES.UNKNOWN_ERROR);
      resultsSection.hidden = true;
    } finally {
      setLoading(false);
    }
  }

  // Form gönderimi
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    performCheck(ipInput.value);
  });

  // Sayfa yüklendiğinde geçmişi göster
  window.IpHistory.renderHistory(historyList, historyEmpty, (selectedIp) => {
    ipInput.value = selectedIp;
    performCheck(selectedIp);
  });
})();
