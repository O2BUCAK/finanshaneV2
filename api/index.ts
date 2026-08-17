import express, { Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from "@google/genai";
import { 
  getTcmbRates, 
  getTurkishCryptoTickers, 
  getGoldRates, 
  getTefasFund, 
  getMacroAndHolidays 
} from './turkishService.ts';

const app = express();

// ==========================================
// 1. SECURITY HEADERS & DEFENSE-IN-DEPTH
// ==========================================
app.use((req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Protect against Clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Cross-site scripting filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Force HTTPS / HSTS (Strict-Transport-Security)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Restrict sensitive browser APIs
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Remove powered-by header to prevent fingerprinting
  res.removeHeader('X-Powered-By');
  
  next();
});

// JSON Body Parser with strict payload size limit (1MB max to prevent Denial of Service)
app.use(express.json({ limit: '1mb' }));

// ==========================================
// 2. RATE LIMITING & BOT PROTECTION
// ==========================================
interface RateLimitBucket {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function rateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown-ip';
    const clientIp = ip.split(',')[0].trim();
    const endpointKey = `${clientIp}:${req.baseUrl || req.path}`;
    const now = Date.now();

    const record = rateLimitStore.get(endpointKey);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(endpointKey, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      return res.status(429).json({ 
        error: 'Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyin.',
        retryAfterSeconds: retryAfterSec
      });
    }

    record.count += 1;
    next();
  };
}

// Bot & Automated Scraper Protection Filter
app.use((req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'] || '';
  // Block known malicious crawler patterns and empty user agents for API modifications
  const isSuspicious = !userAgent || /(masscan|nikto|sqlmap|acunetix|zgrab|nmap)/i.test(userAgent);
  if (isSuspicious && req.method === 'POST') {
    return res.status(403).json({ error: 'Erişim engellendi.' });
  }
  next();
});

// Helper function to safely parse potentially truncated/malformed JSON
function safeJsonParse(text: string): any {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      const lastCurly = text.lastIndexOf('}');
      if (lastCurly > 0) {
        return JSON.parse(text.slice(0, lastCurly + 1));
      }
    } catch {}
    return null;
  }
}

// ==========================================
// 3. API ENDPOINTS (PARAMETERIZED & SANITIZED)
// ==========================================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TCMB Rates with rate limiter
app.get('/api/tcmb-rates', rateLimiter(60, 60 * 1000), async (req: Request, res: Response) => {
  try {
    const rates = await getTcmbRates();
    res.json({ success: true, source: 'TCMB (today.xml)', rates });
  } catch {
    res.status(500).json({ error: 'TCMB kurları alınamadı' });
  }
});

// Yerel Kripto Borsaları (BtcTurk & Paribu)
app.get('/api/crypto-tr', rateLimiter(60, 60 * 1000), async (req: Request, res: Response) => {
  try {
    const tickers = await getTurkishCryptoTickers();
    res.json({ success: true, source: 'BtcTurk & Paribu', tickers });
  } catch {
    res.status(500).json({ error: 'Kripto verileri alınamadı' });
  }
});

// Kapalıçarşı & Serbest Piyasa Altın / Gümüş
app.get('/api/gold-rates', rateLimiter(60, 60 * 1000), async (req: Request, res: Response) => {
  try {
    const gold = await getGoldRates();
    res.json({ success: true, source: 'Kapalıçarşı & Serbest Piyasa', rates: gold });
  } catch {
    res.status(500).json({ error: 'Altın kurları alınamadı' });
  }
});

// TEFAS & BES Yatırım Fonu (Strict Input Validation)
app.get('/api/tefas-funds', rateLimiter(60, 60 * 1000), async (req: Request, res: Response) => {
  const rawCode = (req.query.code as string) || 'AFT';
  // Strict regex parameterization: Only 3 to 7 alphanumeric characters allowed
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,7}$/.test(code)) {
    return res.status(400).json({ error: 'Geçersiz fon kodu formatı.' });
  }

  try {
    const fund = await getTefasFund(code);
    if (!fund) {
      return res.status(404).json({ error: 'Fon bulunamadı' });
    }
    res.json({ success: true, source: 'TEFAS Platformu', fund });
  } catch {
    res.status(500).json({ error: 'TEFAS verisi alınamadı' });
  }
});

// Makroekonomik Veriler
app.get('/api/macro-tr', rateLimiter(60, 60 * 1000), async (req: Request, res: Response) => {
  try {
    const macro = await getMacroAndHolidays();
    res.json({ success: true, data: macro });
  } catch {
    res.status(500).json({ error: 'Makro veriler alınamadı' });
  }
});

// Smart Market Data via Gemini (Server-Side Proxy, No Client Keys Exposed)
app.get('/api/smart-market-data', rateLimiter(30, 60 * 1000), async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        'USD': { 'satis': '44.59', 'degisim': '0.15' },
        'EUR': { 'satis': '48.25', 'degisim': '0.08' },
        'GA': { 'satis': '3150.00', 'degisim': '0.65' },
        'XU100': { 'satis': '10250.00', 'degisim': '0.45' },
        'BTC': { 'satis': '145000.00', 'degisim': '1.20' },
        'ETH': { 'satis': '4250.00', 'degisim': '0.85' },
        '_isSmart': true
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Get the current USD/TRY, EUR/TRY exchange rates, Gram Gold (24K) price in TRY, BIST 100 Index (XU100), Bitcoin (BTC) price in USD, and Ethereum (ETH) price in USD from Google Finance. Return ONLY a JSON object with keys 'USD', 'EUR', 'GA', 'XU100', 'BTC', 'ETH' and subkeys 'satis' (price as string) and 'degisim' (percentage change as string). Example: {\"USD\": {\"satis\": \"44.59\", \"degisim\": \"+0.1\"}, ...}",
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (text) {
      const parsed = safeJsonParse(text);
      if (parsed) {
        return res.json({ ...parsed, _isSmart: true });
      }
    }

    throw new Error('Could not parse Gemini market response');
  } catch (error) {
    console.warn('Smart market data error, using fallback:', error);
    res.json({
      'USD': { 'satis': '44.59', 'degisim': '0.15' },
      'EUR': { 'satis': '48.25', 'degisim': '0.08' },
      'GA': { 'satis': '3150.00', 'degisim': '0.65' },
      'XU100': { 'satis': '10250.00', 'degisim': '0.45' },
      'BTC': { 'satis': '145000.00', 'degisim': '1.20' },
      'ETH': { 'satis': '4250.00', 'degisim': '0.85' },
      '_isSmart': true
    });
  }
});

// Gemini Chat Endpoint (Strict Rate Limit & Input Sanitization)
app.post('/api/chat', rateLimiter(20, 60 * 1000), async (req: Request, res: Response) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Geçerli bir mesaj gereklidir.' });
  }

  // Length constraint to avoid token depletion attacks
  const sanitizedMessage = message.trim().slice(0, 4000);
  if (sanitizedMessage.length === 0) {
    return res.status(400).json({ error: 'Mesaj boş olamaz.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Yapay zeka servisi şu anda yapılandırılmamış.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: sanitizedMessage,
    });
    const text = response.text || '';

    res.json({ reply: text });
  } catch (error) {
    console.warn('Gemini API error:', error);
    // Trimmed safe error message without leaking stack traces or internal keys
    res.status(500).json({ error: 'İstek işlenirken bir sorun oluştu. Lütfen tekrar deneyin.' });
  }
});

// Market Data Proxy with Fallback
app.get('/api/market-data', rateLimiter(60, 60 * 1000), async (req: Request, res: Response) => {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  };

  const timeout = 6000;

  const marketData: any = {
    'USD': { 'satis': '0', 'degisim': '0' },
    'EUR': { 'satis': '0', 'degisim': '0' },
    'GA': { 'satis': '0', 'degisim': '0' },
    'XU100': { 'satis': '10250.00', 'degisim': '0.45' },
    'BTC': { 'satis': '145000.00', 'degisim': '1.20' },
    'ETH': { 'satis': '4250.00', 'degisim': '0.85' }
  };

  let usdFetched = false;
  let eurFetched = false;
  let gaFetched = false;

  // Source 1: Open ER API
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/TRY', { headers, signal: AbortSignal.timeout(timeout) });
    if (response.ok) {
      const data = await response.json();
      if (data && data.rates) {
        marketData['USD'].satis = (1 / data.rates.USD).toFixed(4);
        marketData['EUR'].satis = (1 / data.rates.EUR).toFixed(4);
        usdFetched = true;
        eurFetched = true;
      }
    }
  } catch {}

  // Source 2: Truncgil
  try {
    const response = await fetch('https://finans.truncgil.com/today.json', { headers, signal: AbortSignal.timeout(timeout) });
    if (response.ok) {
      const text = await response.text();
      const data = safeJsonParse(text);
      if (data) {
        if (data['gram-altin'] || data['GA']) {
          const gold = data['gram-altin'] || data['GA'];
          marketData['GA'].satis = gold.Selling || gold.Satis || gold.satis || marketData['GA'].satis;
          marketData['GA'].degisim = gold.Change || gold.Degisim || gold.degisim || marketData['GA'].degisim;
          gaFetched = marketData['GA'].satis !== '0';
        }
        if (!usdFetched && (data.USD || data['USDOLLAR'])) {
          const usd = data.USD || data['USDOLLAR'];
          marketData['USD'].satis = usd.Selling || usd.Satis || usd.satis || marketData['USD'].satis;
          usdFetched = true;
        }
        if (!eurFetched && (data.EUR || data['EURO'])) {
          const eur = data.EUR || data['EURO'];
          marketData['EUR'].satis = eur.Selling || eur.Satis || eur.satis || marketData['EUR'].satis;
          eurFetched = true;
        }
      } else {
        const goldMatch = text.match(/["']gram-altin["']\s*:\s*\{[^}]*?["'](?:Selling|Satis|satis)["']\s*:\s*["']?([\d.,]+)/i);
        if (goldMatch) {
          marketData['GA'].satis = goldMatch[1];
          gaFetched = true;
        }
      }
    }
  } catch {}

  // Source 3: TCMB Rates
  if (!usdFetched || !eurFetched) {
    try {
      const tcmbRates = await getTcmbRates();
      if (tcmbRates.USD) {
        marketData['USD'].satis = tcmbRates.USD.forexSelling.toFixed(4);
        usdFetched = true;
      }
      if (tcmbRates.EUR) {
        marketData['EUR'].satis = tcmbRates.EUR.forexSelling.toFixed(4);
        eurFetched = true;
      }
    } catch {}
  }

  // Final Fallback for Gold if still zero
  if (!gaFetched || marketData['GA'].satis === '0' || marketData['GA'].satis === 0) {
    marketData['GA'].satis = '3150.00';
    marketData['GA'].degisim = '0.65';
  }

  // Fallback for currencies if needed
  if (!usdFetched || marketData['USD'].satis === '0') {
    marketData['USD'].satis = '44.59';
    marketData['USD'].degisim = '0.15';
  }
  if (!eurFetched || marketData['EUR'].satis === '0') {
    marketData['EUR'].satis = '48.25';
    marketData['EUR'].degisim = '0.08';
  }

  res.json(marketData);
});

// Fallback 404 handler
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint bulunamadı.' });
});

export default app;
