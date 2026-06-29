/**
 * Ana uygulama mantığı.
 * Form işlemleri, sonuç gösterimi, dashboard, tablo, CSV export ve geçmiş yönetimi.
 */

(function initApp() {
  // DOM referansları
  const form = document.getElementById('check-form');
  const ipInput = document.getElementById('ip-input');
  const submitBtn = document.getElementById('submit-btn');
  const errorAlert = document.getElementById('error-alert');
  const resultsSection = document.getElementById('results-section');
  const resultsGrid = document.getElementById('results-grid');
  const resultsTableBody = document.getElementById('results-table-body');
  const riskBadge = document.getElementById('risk-badge');
  const csvExportBtn = document.getElementById('csv-export-btn');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');

  // Dashboard istatistik elementleri
  const statTotal = document.getElementById('stat-total');
  const statClean = document.getElementById('stat-clean');
  const statLow = document.getElementById('stat-low');
  const statMedium = document.getElementById('stat-medium');
  const statHigh = document.getElementById('stat-high');
  const statLastIp = document.getElementById('stat-last-ip');

  // CSV export için bellekte tutulan son başarılı sorgu
  let lastQueryResult = null;

  /**
   * Basit IPv4/IPv6 doğrulama (frontend tarafında erken uyarı için).
   * Kesin doğrulama backend'de yapılır.
   */
  function isValidIpFormat(ip) {
    const trimmed = ip.trim();
    if (!trimmed) return false;

    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;

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
   * Risk seviyesine göre durum etiketi döndürür (tablo Status sütunu).
   * @param {object} riskLevel - { level, label }
   * @returns {string} Kısa durum metni
   */
  function getStatusLabel(riskLevel) {
    const statusMap = {
      clean: 'Güvenli',
      low: 'İzle',
      medium: 'Dikkat',
      high: 'Tehlikeli',
      unknown: 'Bilinmiyor',
    };

    return statusMap[riskLevel?.level] || 'Bilinmiyor';
  }

  /**
   * Dashboard istatistik kartlarını günceller.
   */
  function renderDashboard() {
    const stats = window.IpHistory.getDashboardStats();

    statTotal.textContent = String(stats.totalQueries);
    statClean.textContent = String(stats.clean);
    statLow.textContent = String(stats.low);
    statMedium.textContent = String(stats.medium);
    statHigh.textContent = String(stats.high);
    statLastIp.textContent = stats.lastIp;
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
   * Tablo satırı oluşturur.
   * @param {object} row - Sorgu sonucu objesi
   * @param {boolean} isLatest - En son sorgu mu (vurgulama için)
   */
  function createTableRow(row, isLatest = false) {
    const tr = document.createElement('tr');
    if (isLatest) {
      tr.className = 'results-table__row--latest';
    }

    const riskLevel = row.riskLevel?.level || 'unknown';
    const riskLabel = row.riskLevel?.label || 'Bilinmiyor';
    const statusLabel = getStatusLabel(row.riskLevel);

    const cells = [
      { value: row.ipAddress, mono: true },
      { value: String(row.abuseConfidenceScore ?? 0) },
      { value: row.countryCode ?? 'N/A' },
      { value: row.isp ?? 'Bilinmiyor' },
      { value: row.domain ?? 'N/A' },
      { value: String(row.totalReports ?? 0) },
      { value: formatDate(row.lastReportedAt) },
      { value: riskLabel, badge: true, level: riskLevel },
      { value: statusLabel, status: true, level: riskLevel },
    ];

    cells.forEach(({ value, mono, badge, status, level }) => {
      const td = document.createElement('td');

      if (badge) {
        const span = document.createElement('span');
        span.className = `table-badge table-badge--${level}`;
        span.textContent = value;
        td.appendChild(span);
      } else if (status) {
        const span = document.createElement('span');
        span.className = `status-pill status-pill--${level}`;
        span.textContent = value;
        td.appendChild(span);
      } else {
        td.textContent = value ?? '—';
        if (mono) {
          td.className = 'results-table__mono';
        }
      }

      tr.appendChild(td);
    });

    return tr;
  }

  /**
   * LocalStorage'daki tüm sorgu sonuçlarını tabloya render eder.
   * @param {string|null} latestIp - Vurgulanacak en son sorgulanan IP
   */
  function renderResultsTable(latestIp = null) {
    const results = window.IpHistory.getQueryResults();
    resultsTableBody.innerHTML = '';

    if (results.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 9;
      td.className = 'results-table__empty';
      td.textContent = 'Henüz kayıtlı sorgu sonucu yok.';
      tr.appendChild(td);
      resultsTableBody.appendChild(tr);
      return;
    }

    results.forEach((row) => {
      const isLatest = latestIp && row.ipAddress === latestIp;
      resultsTableBody.appendChild(createTableRow(row, isLatest));
    });
  }

  /**
   * Sorgu sonuçlarını ekranda gösterir (kart + tablo).
   * @param {object} data - Backend'den gelen data objesi
   */
  function renderResults(data) {
    lastQueryResult = data;
    csvExportBtn.disabled = false;

    const riskClass = `risk-badge--${data.riskLevel?.level || 'unknown'}`;
    riskBadge.className = `risk-badge ${riskClass}`;
    riskBadge.textContent = `Risk: ${data.riskLevel?.label || 'Bilinmiyor'} (Skor: ${data.abuseConfidenceScore})`;

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

    renderResultsTable(data.ipAddress);
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * CSV hücre değerini güvenli biçimde kaçırır (virgül, tırnak, satır sonu).
   * @param {string|number|null} value
   * @returns {string}
   */
  function escapeCsvValue(value) {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  /**
   * Son sorgu sonucunu CSV dosyası olarak indirir.
   */
  function exportLastResultToCsv() {
    if (!lastQueryResult) {
      showError('İndirilecek sorgu sonucu bulunamadı. Önce bir IP sorgulayın.');
      return;
    }

    const data = lastQueryResult;
    const headers = [
      'IP Address',
      'Abuse Score',
      'Country Code',
      'ISP',
      'Domain',
      'Total Reports',
      'Last Reported At',
      'Risk Level',
    ];

    const row = [
      data.ipAddress,
      data.abuseConfidenceScore,
      data.countryCode,
      data.isp,
      data.domain,
      data.totalReports,
      data.lastReportedAt ? formatDate(data.lastReportedAt) : 'Hiç raporlanmadı',
      data.riskLevel?.label || 'Bilinmiyor',
    ];

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      row.map(escapeCsvValue).join(','),
    ].join('\n');

    // UTF-8 BOM: Excel'de Türkçe karakterlerin doğru görünmesi için
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const safeIp = String(data.ipAddress).replace(/[^a-zA-Z0-9.-]/g, '_');
    link.href = url;
    link.download = `ip-reputation-${safeIp}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  /**
   * IP sorgusu yapar (form gönderimi veya geçmişten seçim).
   * @param {string} ip - Sorgulanacak IP
   */
  async function performCheck(ip) {
    hideError();

    const trimmed = ip.trim();

    if (!trimmed) {
      showError(window.IpApi.ERROR_MESSAGES.EMPTY_IP);
      ipInput.focus();
      return;
    }

    if (!isValidIpFormat(trimmed)) {
      showError(window.IpApi.ERROR_MESSAGES.INVALID_IP);
      ipInput.focus();
      return;
    }

    setLoading(true);

    try {
      const data = await window.IpApi.checkIp(trimmed);
      renderResults(data);

      window.IpHistory.addToHistory(trimmed);
      window.IpHistory.addQueryResult(data);
      window.IpHistory.renderHistory(historyList, historyEmpty, (selectedIp) => {
        ipInput.value = selectedIp;
        performCheck(selectedIp);
      });
      renderDashboard();
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

  // CSV indirme butonu
  csvExportBtn.addEventListener('click', exportLastResultToCsv);

  /**
   * Sayfa yüklendiğinde LocalStorage'daki son sonucu geri yükler.
   * Dashboard istatistikleri ve tablo böylece yenilemede de görünür kalır.
   */
  function restoreLastSession() {
    const storedResults = window.IpHistory.getQueryResults();

    if (storedResults.length > 0) {
      const latest = storedResults[0];
      lastQueryResult = latest;
      csvExportBtn.disabled = false;

      const riskClass = `risk-badge--${latest.riskLevel?.level || 'unknown'}`;
      riskBadge.className = `risk-badge ${riskClass}`;
      riskBadge.textContent = `Risk: ${latest.riskLevel?.label || 'Bilinmiyor'} (Skor: ${latest.abuseConfidenceScore})`;

      resultsGrid.innerHTML = '';
      const rows = [
        { label: 'IP Address', value: latest.ipAddress, mono: true },
        { label: 'Abuse Confidence Score', value: String(latest.abuseConfidenceScore) },
        { label: 'Country Code', value: latest.countryCode },
        { label: 'ISP', value: latest.isp },
        { label: 'Domain', value: latest.domain },
        { label: 'Total Reports', value: String(latest.totalReports) },
        { label: 'Last Reported At', value: formatDate(latest.lastReportedAt) },
        { label: 'Risk Level', value: latest.riskLevel?.label || 'Bilinmiyor' },
      ];

      rows.forEach(({ label, value, mono }) => {
        resultsGrid.appendChild(createResultRow(label, value, mono));
      });

      resultsSection.hidden = false;
    }
  }

  // Sayfa yüklendiğinde geçmiş, tablo ve dashboard'u göster
  window.IpHistory.renderHistory(historyList, historyEmpty, (selectedIp) => {
    ipInput.value = selectedIp;
    performCheck(selectedIp);
  });
  restoreLastSession();
  renderResultsTable(window.IpHistory.getQueryResults()[0]?.ipAddress ?? null);
  renderDashboard();
})();
