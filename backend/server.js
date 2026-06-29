/**
 * IP Reputation Checker - Ana sunucu dosyası
 *
 * Express ile:
 *  - POST /check  → IP itibar sorgusu (AbuseIPDB)
 *  - Statik dosyalar → ../frontend klasöründen servis edilir
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const checkRoute = require('./routes/check');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON istek gövdelerini parse et
app.use(express.json());

// Geliştirme sırasında farklı porttan erişim için CORS (opsiyonel)
app.use(cors());

// API endpoint'i
app.use('/check', checkRoute);

// Frontend statik dosyalarını servis et (HTML, CSS, JS)
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Bilinmeyen rotalar için ana sayfaya yönlendir
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`IP Reputation Checker çalışıyor: http://localhost:${PORT}`);
  console.log('API endpoint: POST http://localhost:' + PORT + '/check');
});
