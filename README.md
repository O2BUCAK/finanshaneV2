# 🪙 FinansHane | Aile ve Ev Bütçesi Takip Platformu

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/)
[![Security Audit](https://img.shields.io/badge/vulnerabilities-0%20(zero)-success.svg)](https://github.com/)
[![Vitest Tests](https://img.shields.io/badge/tests-8%20passed-success.svg)](https://github.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646cff.svg)](https://vitejs.dev/)
[![KVKK & 2026 TR Uyumlu](https://img.shields.io/badge/KVKK%202026-Tam%20Uyumlu-emerald.svg)](https://www.kvkk.gov.tr/)
[![License](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Free & Open Source](https://img.shields.io/badge/Free%20%26%20Open%20Source-100%25-green.svg)](https://github.com/)

> **FinansHane**, aileler ve bireyler için geliştirilmiş, gizlilik öncelikli (*Local-First / Zero-Knowledge*), çift kayıtlı muhasebe altyapısına sahip, banka ekstrelerini istemci tarafında çözümleyen modern ve **tamamen ücretsiz / açık kaynaklı** bir bütçe ve finans yönetim platformudur.

---

## 📌 İçindekiler

- [Öne Çıkan Özellikler](#-öne-çıkan-özellikler)
- [Ücretsiz ve Açık Kaynak Felsefesi](#-ücretsiz-ve-açık-kaynak-felsefesi)
- [Bilgi Güvenliği ve 2026 Türkiye Mevzuatı](#-bilgi-güvenliği-ve-2026-türkiye-mevzuatı)
- [Teknoloji Mimarisi](#-teknoloji-mimarisi)
- [Kurulum ve Başlangıç](#-kurulum-ve-başlangıç)
- [Test ve Güvenlik Denetimleri](#-test-ve-güvenlik-denetimleri)
- [Ortam Değişkenleri (.env)](#-ortam-değişkenleri-env)
- [Dizin Yapısı](#-dizin-yapısı)
- [Güvenlik ve Açık Bildirimi (Responsible Disclosure)](#-güvenlik-ve-açık-bildirimi)
- [Lisans](#-lisans)

---

## ✨ Öne Çıkan Özellikler

### 🏦 İstemci Taraflı Banka Ekstresi Ayrıştırıcı (Statement Parser)
- **Gizlilik Odaklı İşleme:** CSV ve Excel (.xlsx) banka ekstreleri sunucuya gönderilmeden **doğrudan tarayıcınızda** işlenir.
- **Türk Bankaları ile Hazır Şablonlar:** İş Bankası, Garanti BBVA, Yapı Kredi, Akbank, QNB, Ziraat Bankası, VakıfBank, Papara, Enpara ve FAST transfer dökümlerini otomatik tanır.
- **Otomatik Akıllı Kategorilendirme:** Market, akaryakıt, fatura, restoran, eğitim vb. harcamaları otomatik eşler.

### 👨‍👩‍👧‍👦 Aile İçi Bütçe & Ortak Harcama Takibi
- Hane üyelerini tanımlama ve harcamaları kişilere göre etiketleme.
- Kimin ne kadar harcadığını, ortak kasaya ne kadar borçlu olduğunu net gösteren hesaplaşma paneli.
- **Çift Kayıtlı Defter-i Kebir (Double-Entry Bookkeeping):** Kasa, banka hesapları, kredi kartları ve borçlar arasında bakiye tutarlılığı.

### 📊 Görsel Finans ve Nakit Akışı Analitiği
- **D3.js Sankey Diyagramı:** Gelir kaynaklarınızdan (maaş, ek gelir, kira) harcama kategorilerine ve tasarruflara olan nakit akışını interaktif olarak görselleştirin.
- **Recharts Grafikleri:** Kategori bazlı pasta grafikleri, aylık gelir-gider trendleri, tasarruf hedefleri.

### 🇹🇷 Türkiye Resmi ve Ücretsiz Finans Hub'ı
- **TCMB Kurları:** Türkiye Cumhuriyet Merkez Bankası resmi gösterge kurlarını anlık izleme.
- **TÜİK Enflasyon & Makro:** Enflasyon verileri (TÜFE/Yİ-ÜFE) ve resmi tatil takvimi.
- **Serbest Piyasa Altın Fiyatları:** Gram, Çeyrek, Yarım, Tam ve Cumhuriyet Altını canlı takibi.
- **TEFAS Fon Sorgulama:** Türkiye Elektronik Fon Dağıtım Platformu (TEFAS) yatırım fonu getirileri.
- **Türk Kripto Borsaları:** BtcTurk ve Paribu TL pariteleri.

### 🤖 Gizlilik Odaklı Yapay Zeka Finans Danışmanı (Opsiyonel)
- Gemini API entegrasyonu ile tasarruf analizi ve bütçe tavsiyeleri.
- **Kişisel Veri Korumalı:** AI modeline asla kişisel ad, IBAN, kart numarası veya kimlik verisi gönderilmez; yalnızca toplu sayısal istatistikler ve anonimleştirilmiş bütçe kategorileri iletilir.

### 📅 Sabit Gider & Abonelik Yönetimi
- Dijital platform abonelikleri (Netflix, Spotify, YouTube vb.), kira, aidat ve kredi taksitleri için yenilenme takvimi ve bildirimler.

---

## 🆓 Ücretsiz ve Açık Kaynak Felsefesi

FinansHane, kullanıcının verisini ürün haline getiren veya ücretli SaaS modellerine bağımlı kılan sistemlere alternatif olarak geliştirilmiştir:

1. **Sıfır Zorunlu Ücret:** Uygulama tamamen ücretsizdir. Harici ücretli API zorunluluğu yoktur.
2. **Kendi Sunucunda Barındırılabilir (Self-Hostable):** Tek bir komutla kendi yerel makinenizde, Docker üzerinde veya kişisel sunucunuzda çalıştırabilirsiniz.
3. **Satıcı Kilidi Yok (No Vendor Lock-in):** Tüm verilerinizi istediğiniz an JSON veya CSV olarak dışa aktarabilirsiniz.
4. **Çevrimdışı Çalışma (Offline-First):** İnternet bağlantınız olmasa dahi Dexie.js (IndexedDB) üzerinde tam fonksiyonel olarak çalışmaya devam eder.

---

## 🛡️ Bilgi Güvenliği ve 2026 Türkiye Mevzuatı

Proje mimarisi; **6698 Sayılı Kişisel Verilerin Korunması Kanunu (KVKK)**, 2026 yılı güncel AB GDPR uyum reformları, **5651 Sayılı Kanun** ve **BDDK/TCMB Açık Bankacılık Veri Güvenliği** ilkeleri dikkate alınarak tasarlanmıştır.

| Güvenlik Katmanı | Uygulanan Standart & Önlem |
| :--- | :--- |
| **Veri İzolasyonu (Local-First)** | Banka ekstreleri, hesap hareketleri ve mali tablolar sunucuya yüklenmez; yerel tarayıcı veritabanında (IndexedDB) saklanır. |
| **Uçtan Uca Şifreleme** | Hassas veriler istemcide `Crypto-JS` kullanılarak **AES-256** standardında şifrelenir. |
| **Hassas Veri Maskeleme** | IBAN numaraları (`TR33 **** **** **** **** 5678`), kredi kartları (`**** **** **** 1234`) ve e-postalar KVKK uyumlu olarak otomatik maskelenir. |
| **XSS & HTML Sanitization** | Kullanıcı girdileri kontrol karakterlerinden arındırılır ve tüm HTML etiketleri render öncesi sanitize edilir (`escapeHtml`). |
| **DoS & ReDoS Koruması** | `proxy-addr` (#43), `source-map-js` (#44), `postcss-selector-parser` (#45) ve `body-parser` güncel güvenlik yamalarıyla kilitlenmiştir. Sıfır zaafiyet (`npm audit: 0`). |
| **HTTP Güvenlik Başlıkları** | `Content-Security-Policy` (CSP), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (HSTS), `Permissions-Policy`. |
| **Hız Sınırlaması (Rate Limiting)**| Backend API proxy uç noktalarında IP başına dakikada maksimum 100 istek sınırı ve DoS engelleme. |
| **KVKK Rıza Modülü** | Kullanıcı ilk açılışta açık rıza ve aydınlatma metnini onaylamadan veri işleme başlatılmaz; onay durumu yerel olarak kaydedilir. |

---

## 💻 Teknoloji Mimarisi

- **Kullanıcı Arayüzü (UI):** React 18, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion
- **Görselleştirme & Grafikler:** Recharts, D3.js (D3-Sankey)
- **Yerel Depolama (Local DB):** Dexie.js (IndexedDB wrapper) & Dexie React Hooks
- **Kriptografi & Güvenlik:** Crypto-JS (AES-256), Zod v4 (Şema Doğrulama)
- **Banka Ekstre Ayrıştırma:** PapaParse (CSV), Read-Excel-File (XLSX)
- **Sunucu & API Proxy:** Node.js, Express, TSX, Vite 6
- **Test Çatısı:** Vitest (Birim ve Güvenlik Sanitization Testleri)

---

## 🚀 Kurulum ve Başlangıç

### Önkoşullar
- **Node.js**: v18.0.0 veya üzeri (v20+ LTS önerilir)
- **npm**: v9.0.0 veya üzeri

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/kullaniciadi/finanshane.git
cd finanshane
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Ortam Değişkenlerini Tanımlayın
```bash
cp .env.example .env
```
*(Yapay Zeka Finans Danışmanı özelliğini kullanmak isterseniz `.env` dosyasına `GEMINI_API_KEY` ekleyebilirsiniz. Zorunlu değildir; uygulama AI anahtarı olmadan da tüm özellikleriyle eksiksiz çalışır.)*

### 4. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```
Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışacaktır.

---

## 🧪 Test ve Güvenlik Denetimleri

FinansHane, veri güvenliği ve ekstre ayrıştırma fonksiyonlarının doğrulanması için kapsamlı birim testlerine sahiptir:

```bash
# Tüm birim ve güvenlik testlerini çalıştır
npm test

# TypeScript tip denetimini gerçekleştir
npm run lint

# Güvenlik açığı taraması yap (Sıfır zaafiyet garantisi)
npm audit
```

Tüm testler ve güvenlik denetimleri başarıyla tamamlanmaktadır:
- `src/test/security.test.ts` (XSS sanitization, KVKK maskeleme, AES-256 şifreleme)
- `src/test/statementParser.test.ts` (Banka ekstre formatlarının doğrulanması)

---

## ⚙️ Ortam Değişkenleri (.env)

| Değişken | Açıklama | Zorunlu mu? | Varsayılan |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Opsiyonel Yapay Zeka Finans Danışmanı için Google Gemini API anahtarı | Hayır | `Boş` |
| `PORT` | Uygulama sunucu portu | Hayır | `3000` |
| `NODE_ENV` | Çalışma ortamı (`development` / `production`) | Hayır | `development` |

---

## 📁 Dizin Yapısı

```text
├── api/                        # Express API Proxy ve Güvenli Uç Noktalar
│   ├── index.ts                # Güvenlik başlıkları, rate-limiting & rotalar
│   └── turkishService.ts       # TCMB, TÜİK, Altın, TEFAS veri servisleri
├── src/
│   ├── components/             # Yeniden kullanılabilir React bileşenleri
│   │   ├── AccountsView.tsx    # Hesaplar ve bakiye yönetimi
│   │   ├── AiAdvisor.tsx       # AI Bütçe Danışmanı arayüzü
│   │   ├── Dashboard.tsx       # Ana gösterge paneli ve özet kartlar
│   │   ├── HouseholdMembers.tsx# Aile bireyleri ve borçlaşma paneli
│   │   ├── KVKKConsentModal.tsx# KVKK Aydınlatma ve Açık Rıza Modalı
│   │   ├── SankeyChart.tsx     # D3 Sankey nakit akışı diyagramı
│   │   ├── StatementImportModal.tsx # CSV/Excel ekstre ayrıştırma
│   │   ├── SubscriptionsView.tsx    # Abonelikler ve sabit ödemeler
│   │   └── TurkishApisHub.tsx  # TCMB, Altın, TEFAS ve BIST göstergeleri
│   ├── db.ts                   # Dexie.js (IndexedDB) yerel şema tanımı
│   ├── test/                   # Vitest birim ve güvenlik testleri
│   │   ├── security.test.ts    # Maskeleme, sanitization & crypto testleri
│   │   └── statementParser.test.ts # Ekstre parser testleri
│   ├── utils/
│   │   ├── crypto.ts           # AES-256 şifreleme yardımcıları
│   │   ├── security.ts         # XSS koruması ve KVKK maskeleme fonksiyonları
│   │   └── statementParser.ts  # Banka formatlarını ayrıştırma motoru
│   ├── App.tsx                 # Ana uygulama çatısı ve navigasyon
│   └── main.tsx                # React DOM giriş noktası
├── firestore.rules             # Opsiyonel Firebase Firestore güvenlik kuralları
├── package.json                # Proje bağımlılıkları ve güvenlik geçersiz kılmaları
├── server.ts                   # Vite middleware destekli Express sunucu girişi
└── vite.config.ts              # Vite yapılandırması
```

---

## 🔒 Güvenlik ve Açık Bildirimi

Projede bilgi güvenliği en üst önceliğe sahiptir. Uygulamada herhangi bir güvenlik zafiyeti tespit ederseniz, lütfen GitHub Issues üzerinden genel olarak paylaşmak yerine doğrudan sorumlu bildirim (*Responsible Disclosure*) ilkelerine uygun olarak proje yöneticileri ile iletişime geçiniz.

Bildirilen tüm zaafiyetler en geç **24 saat** içerisinde incelenir ve yama yayınlanır.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) kapsamında açık kaynak olarak lisanslanmıştır. Ticari veya kişisel amaçlarla özgürce kullanılabilir, değiştirilebilir ve dağıtılabilir.
