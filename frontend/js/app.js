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

  // CSV export için son sorgu grubu
  let lastBatchResults = [];

  /**
   * Basit IPv4/IPv6 doğrulama (frontend tarafında erken uyarı için).
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
   * Risk seviyesine göre durum etiketi döndürür.
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
   * OTX verisinden okunabilir pulse sayısı veya durum metni döndürür.
   */
  function getOtxPulseText(otx) {
    if (!otx) return '—';
    if (!otx.available) return otx.error || 'Yapılandırılmadı';
    return String(otx.pulseCount ?? 0);
  }

  /**
   * OTX verisinden reputation skoru veya durum metni döndürür.
   */
  function getOtxRepText(otx) {
    if (!otx || !otx.available) return '—';
    return String(otx.reputation ?? 0);
  }

  /**
   * Başarılı bir sonuç için tablo satırı oluşturur.
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
      { value: getOtxPulseText(row.otx) },
      { value: getOtxRepText(row.otx) },
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
   * Hatalı bir IP için tablo satırı oluşturur.
   */
  function createErrorTableRow(ip, message) {
    const tr = document.createElement('tr');
    tr.className = 'results-table__row--error';

    const tdIp = document.createElement('td');
    tdIp.className = 'results-table__mono';
    tdIp.textContent = ip;
    tr.appendChild(tdIp);

    const tdMsg = document.createElement('td');
    tdMsg.colSpan = 10;
    tdMsg.className = 'results-table__error-msg';
    tdMsg.textContent = message;
    tr.appendChild(tdMsg);

    return tr;
  }

  /**
   * LocalStorage'daki tüm sorgu sonuçlarını tabloya render eder.
   */
  function renderResultsTable(latestIp = null) {
    const results = window.IpHistory.getQueryResults();
    resultsTableBody.innerHTML = '';

    if (results.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 11;
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
   * Toplu sorgu sonuçlarını tabloya render eder (başarılı + hatalı).
   */
  function renderBatchTable(batchResults) {
    resultsTableBody.innerHTML = '';

    batchResults.forEach(({ ip, data, errorMessage }) => {
      if (data) {
        resultsTableBody.appendChild(createTableRow(data, false));
      } else {
        resultsTableBody.appendChild(createErrorTableRow(ip, errorMessage));
      }
    });
  }

  /**
   * Tek IP sonucunu ekranda gösterir (kart + tablo).
   */
  function renderSingleResult(data) {
    const riskClass = `risk-badge--${data.riskLevel?.level || 'unknown'}`;
    riskBadge.className = `risk-badge ${riskClass}`;
    riskBadge.textContent = `Risk: ${data.riskLevel?.label || 'Bilinmiyor'} (Skor: ${data.abuseConfidenceScore})`;

    resultsGrid.hidden = false;
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
      { label: 'OTX Pulse Count', value: getOtxPulseText(data.otx) },
      { label: 'OTX Reputation', value: getOtxRepText(data.otx) },
    ];

    rows.forEach(({ label, value, mono }) => {
      resultsGrid.appendChild(createResultRow(label, value, mono));
    });
  }

  /**
   * Toplu sorgu özet badge'ini günceller.
   */
  function renderBatchSummaryBadge(batchResults) {
    const successCount = batchResults.filter((r) => r.data).length;
    const errorCount = batchResults.filter((r) => r.errorMessage).length;
    const highCount = batchResults.filter(
      (r) => r.data?.riskLevel?.level === 'high'
    ).length;

    let badgeLevel = 'clean';
    if (errorCount > 0 || highCount > 0) badgeLevel = 'high';
    else if (batchResults.some((r) => r.data?.riskLevel?.level === 'medium')) badgeLevel = 'medium';
    else if (batchResults.some((r) => r.data?.riskLevel?.level === 'low')) badgeLevel = 'low';

    riskBadge.className = `risk-badge risk-badge--${badgeLevel}`;
    riskBadge.textContent =
      `${batchResults.length} IP sorgulandı — ${successCount} başarılı` +
      (errorCount > 0 ? `, ${errorCount} hatalı` : '') +
      (highCount > 0 ? ` · ${highCount} yüksek riskli` : '');

    resultsGrid.hidden = true;
    resultsGrid.innerHTML = '';
  }

  /**
   * CSV hücre değerini güvenli biçimde kaçırır.
   */
  function escapeCsvValue(value) {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  /**
   * Son sorgu grubunu CSV olarak indirir (tek veya çoklu IP).
   */
  function exportLastResultToCsv() {
    if (!lastBatchResults || lastBatchResults.length === 0) {
      showError('İndirilecek sorgu sonucu bulunamadı. Önce bir IP sorgulayın.');
      return;
    }

    const headers = [
      'IP Address',
      'Abuse Score',
      'Country Code',
      'ISP',
      'Domain',
      'Total Reports',
      'Last Reported At',
      'Risk Level',
      'Status',
      'OTX Pulse Count',
      'OTX Reputation',
    ];

    const dataRows = lastBatchResults.map(({ ip, data, errorMessage }) => {
      if (data) {
        return [
          data.ipAddress,
          data.abuseConfidenceScore,
          data.countryCode,
          data.isp,
          data.domain,
          data.totalReports,
          data.lastReportedAt ? formatDate(data.lastReportedAt) : 'Hiç raporlanmadı',
          data.riskLevel?.label || 'Bilinmiyor',
          getStatusLabel(data.riskLevel),
          getOtxPulseText(data.otx),
          getOtxRepText(data.otx),
        ];
      }
      return [ip, '', '', '', '', '', '', 'Hata', errorMessage || '', '', ''];
    });

    const csvLines = [
      headers.map(escapeCsvValue).join(','),
      ...dataRows.map((row) => row.map(escapeCsvValue).join(',')),
    ];

    const blob = new Blob(['﻿' + csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = url;
    link.download =
      lastBatchResults.length === 1
        ? `ip-reputation-${String(lastBatchResults[0].ip).replace(/[^a-zA-Z0-9.-]/g, '_')}.csv`
        : `ip-reputation-batch-${timestamp}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Geçmiş listesini yeniler.
   */
  function refreshHistory() {
    window.IpHistory.renderHistory(historyList, historyEmpty, (selectedIp) => {
      ipInput.value = selectedIp;
      performBatchCheck(selectedIp);
    });
  }

  /**
   * Textarea'daki IP adreslerini satır satır parse eder.
   * Boş satırları ve tekrar eden IP'leri temizler.
   */
  function parseIpList(rawInput) {
    const seen = new Set();
    return rawInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        if (seen.has(line)) return false;
        seen.add(line);
        return true;
      });
  }

  /**
   * Tek veya çoklu IP sorgusunu yönetir.
   */
  async function performBatchCheck(rawInput) {
    hideError();

    const ips = parseIpList(rawInput);

    if (ips.length === 0) {
      showError(window.IpApi.ERROR_MESSAGES.EMPTY_IP);
      ipInput.focus();
      return;
    }

    setLoading(true);

    const batchResults = [];

    for (const ip of ips) {
      if (!isValidIpFormat(ip)) {
        batchResults.push({
          ip,
          data: null,
          errorMessage: `Geçersiz IP: ${window.IpApi.ERROR_MESSAGES.INVALID_IP}`,
        });
        continue;
      }

      try {
        const data = await window.IpApi.checkIp(ip);
        batchResults.push({ ip, data, errorMessage: null });
        window.IpHistory.addToHistory(ip);
        window.IpHistory.addQueryResult(data);
      } catch (error) {
        batchResults.push({
          ip,
          data: null,
          errorMessage: error.message || window.IpApi.ERROR_MESSAGES.UNKNOWN_ERROR,
        });
      }
    }

    setLoading(false);

    lastBatchResults = batchResults;
    csvExportBtn.disabled = false;

    const successResults = batchResults.filter((r) => r.data);

    if (ips.length === 1 && successResults.length === 1) {
      // Tek başarılı IP: detay kartı göster
      renderSingleResult(successResults[0].data);
      renderResultsTable(successResults[0].data.ipAddress);
    } else if (ips.length === 1 && successResults.length === 0) {
      // Tek IP, başarısız: hata göster
      showError(batchResults[0].errorMessage);
      csvExportBtn.disabled = true;
      lastBatchResults = [];
      setLoading(false);
      return;
    } else {
      // Çoklu IP: özet badge + toplu tablo
      renderBatchSummaryBadge(batchResults);
      renderBatchTable(batchResults);
    }

    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    refreshHistory();
    renderDashboard();
  }

  // Form gönderimi
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    performBatchCheck(ipInput.value);
  });

  // CSV indirme butonu
  csvExportBtn.addEventListener('click', exportLastResultToCsv);

  /**
   * Sayfa yüklendiğinde LocalStorage'daki son sonucu geri yükler.
   */
  function restoreLastSession() {
    const storedResults = window.IpHistory.getQueryResults();

    if (storedResults.length > 0) {
      const latest = storedResults[0];
      lastBatchResults = [{ ip: latest.ipAddress, data: latest, errorMessage: null }];
      csvExportBtn.disabled = false;
      renderSingleResult(latest);
      resultsSection.hidden = false;
    }
  }

  // Sayfa yüklendiğinde geçmiş, tablo ve dashboard'u göster
  refreshHistory();
  restoreLastSession();
  renderResultsTable(window.IpHistory.getQueryResults()[0]?.ipAddress ?? null);
  renderDashboard();
})();
