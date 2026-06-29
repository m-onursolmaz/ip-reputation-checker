# IP Reputation Checker

IPv4 ve IPv6 adreslerinin itibar skorunu sorgulayan full stack web uygulaması. Kullanıcı bir IP adresi girer; backend AbuseIPDB API'sine istek atar ve sonuçları modern bir arayüzde gösterir.

## Proje Ne Yapıyor?

- Kullanıcının girdiği tek veya birden fazla IP adresini doğrular (IPv4 / IPv6)
- Backend üzerinden AbuseIPDB API'sine güvenli sorgu gönderir
- IP'nin abuse skoru, ülke kodu, ISP, domain, rapor sayısı ve risk seviyesini gösterir
- Çoklu sorgularda her IP ayrı ayrı işlenir; bir IP başarısız olsa diğerleri devam eder
- Son sorgulanan IP'leri tarayıcı LocalStorage'ında saklar
- Dashboard ile sorgu istatistiklerini özetler
- Sorgu sonuçlarını CSV olarak indirmeyi destekler (tek veya çoklu IP)

## Hangi API'ler Kullanılıyor?

### AbuseIPDB (Zorunlu)

[AbuseIPDB API v2](https://docs.abuseipdb.com/) — `GET https://api.abuseipdb.com/api/v2/check`

Backend, API anahtarını HTTP `Key` header'ı ile gönderir. API anahtarı yalnızca sunucu tarafında tutulur; frontend doğrudan AbuseIPDB'ye istek atmaz.

### VirusTotal (Opsiyonel)

[VirusTotal API v3](https://developers.virustotal.com/reference/ip-info) — `GET https://www.virustotal.com/api/v3/ip_addresses/{ip}`

VirusTotal entegrasyonu tamamen opsiyoneldir:
- `VT_API_KEY` `.env` dosyasında tanımlıysa her sorguda 70+ antivirüs motorunun analiz sonuçları çekilir
- `VT_API_KEY` yoksa veya boşsa uygulama sorunsuz çalışmaya devam eder; VT sütunları "Yapılandırılmadı" veya "—" olarak gösterilir
- VT'den hata gelse bile AbuseIPDB sonucu etkilenmez

VT'den alınan bilgiler:
- **VT Malicious** — IP'yi zararlı bulan motor sayısı
- **VT Suspicious** — IP'yi şüpheli bulan motor sayısı
- **VT Harmless** — IP'yi temiz bulan motor sayısı
- **VT Undetected** — IP hakkında sonuç bildirmeyen motor sayısı

### AlienVault OTX (Opsiyonel)

[AlienVault OTX API v1](https://otx.alienvault.com/api) — `GET https://otx.alienvault.com/api/v1/indicators/IPv4/{ip}/general`

OTX entegrasyonu tamamen opsiyoneldir:
- `OTX_API_KEY` `.env` dosyasında tanımlıysa her sorguda OTX'ten ek tehdit bilgisi çekilir
- `OTX_API_KEY` yoksa veya boşsa uygulama sorunsuz çalışmaya devam eder; OTX sütunları "Yapılandırılmadı" olarak gösterilir
- OTX'ten hata gelse bile AbuseIPDB sonucu etkilenmez

OTX'ten alınan bilgiler:
- **Pulse Count** — IP'nin kaç adet tehdit istihbarat kaydında (pulse) geçtiği
- **Reputation** — OTX reputation skoru (0 = temiz, yükseldikçe şüpheli)

## Nasıl Çalıştırılır?

### Gereksinimler

- [Node.js](https://nodejs.org/) (v18 veya üzeri önerilir)
- AbuseIPDB hesabı ve API anahtarı

### 1. API Anahtarını Ayarlayın

```powershell
cd backend
Copy-Item .env.example .env
```

`.env` dosyasını açın ve değerleri doldurun:

```
ABUSEIPDB_API_KEY=gercek_abuseipdb_anahtariniz
OTX_API_KEY=gercek_otx_anahtariniz
PORT=3000
```

- **ABUSEIPDB_API_KEY** — [AbuseIPDB hesap sayfasından](https://www.abuseipdb.com/account/api) alın (zorunlu)
- **VT_API_KEY** — [VirusTotal API sayfasından](https://www.virustotal.com/gui/my-apikey) alın (opsiyonel; bırakılabilir)
- **OTX_API_KEY** — [AlienVault OTX API sayfasından](https://otx.alienvault.com/api) alın (opsiyonel; bırakılabilir)

### 2. Backend Bağımlılıklarını Kurun

```powershell
cd backend
npm install
```

### 3. Backend'i Başlatın

```powershell
npm start
```

Geliştirme sırasında dosya değişikliklerinde otomatik yeniden başlatma:

```powershell
npm run dev
```

Backend başarıyla çalıştığında terminalde şu mesajı görürsünüz:

```
IP Reputation Checker çalışıyor: http://localhost:3000
```

### 4. Frontend'i Açın

Express, frontend dosyalarını aynı port üzerinden statik olarak sunar. Backend çalışırken tarayıcıda şu adresi açın:

```
http://localhost:3000
```

Ayrı bir frontend sunucusu gerekmez.

## API Key Neden `.env` İçinde Tutuluyor?

AbuseIPDB API anahtarları gizli kimlik bilgisidir. Anahtar frontend'e taşınırsa:

- Tarayıcı geliştirici araçlarında görünür hale gelir
- Kötü niyetli kullanıcılar anahtarınızı çalabilir
- API kotanız tükenebilir

Bu nedenle anahtar yalnızca backend'deki `.env` dosyasında saklanır. Frontend, `fetch('/check')` ile kendi backend'inize istek atar; backend AbuseIPDB ile konuşur.

`.env` dosyası `.gitignore` içinde yer alır ve versiyon kontrolüne eklenmemelidir. Paylaşım için `.env.example` şablonu kullanılır.

## Risk Seviyeleri Nasıl Hesaplanıyor?

AbuseIPDB'den dönen **Abuse Confidence Score** (0–100) değerine göre:

| Skor    | Risk Seviyesi |
|---------|---------------|
| 0       | Temiz         |
| 1–25    | Düşük Risk    |
| 26–75   | Orta Risk     |
| 76–100  | Yüksek Risk   |

Hesaplama backend'de `backend/utils/riskLevel.js` dosyasında yapılır ve sonuç frontend'e `riskLevel` objesi olarak iletilir.

## Bonus Özellikler

### Çoklu IP Sorgulama

- Textarea'ya her satıra bir IP yazarak toplu sorgu yapılabilir
- Tek IP girilirse mevcut detay kartı gösterilir
- Birden fazla IP girilirse özet badge ve toplu tablo gösterilir
- Boş satırlar ve tekrar eden IP'ler otomatik yoksayılır
- Bir IP hata verse diğerleri sorgulanmaya devam eder; hatalı IP'ler tabloda kırmızı satırla gösterilir

### CSV Export

- Sorgu sonrası **CSV İndir** butonu aktif olur
- Tek IP sorgusunda tek satırlık CSV, çoklu sorguda tüm sonuçlar (başarılı + hatalı) CSV'ye eklenir
- Sütunlar: IP Address, Abuse Score, Country Code, ISP, Domain, Total Reports, Last Reported At, Risk Level, Status
- UTF-8 BOM ile Excel uyumluluğu sağlanır

### Sonuç Tablosu

- Tek IP: detay kart + tablo
- Çoklu IP: özet badge + toplu tablo (hatalı IP'ler de gösterilir)
- Status sütunu risk seviyesine göre kısa durum etiketi gösterir (Güvenli, İzle, Dikkat, Tehlikeli)

### Dashboard

Sayfanın üst kısmında istatistik kartları:

- Toplam sorgu sayısı
- Temiz IP sayısı
- Düşük / Orta / Yüksek risk sayıları
- En son sorgulanan IP

Veriler LocalStorage'daki sorgu geçmişinden hesaplanır; sayfa yenilendiğinde korunur.

## Proje Yapısı

```
ip-reputation-checker/
├── backend/
│   ├── server.js              # Express sunucusu
│   ├── routes/check.js        # POST /check endpoint
│   ├── services/abuseIpDb.js  # AbuseIPDB entegrasyonu
│   └── utils/                 # IP doğrulama, risk hesaplama
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   └── js/                    # app, api, history modülleri
└── README.md
```

## API Endpoint

```
POST /check
Content-Type: application/json

{ "ip": "8.8.8.8" }
```

Başarılı yanıt örneği:

```json
{
  "success": true,
  "data": {
    "ipAddress": "8.8.8.8",
    "abuseConfidenceScore": 0,
    "countryCode": "US",
    "isp": "Google LLC",
    "domain": "google.com",
    "totalReports": 0,
    "lastReportedAt": null,
    "riskLevel": { "level": "clean", "label": "Temiz" }
  }
}
```
