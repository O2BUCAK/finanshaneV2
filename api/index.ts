import express from 'express';
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gemini API endpoint
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
    });
    const text = response.text;

    res.json({ reply: text });
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Market Data Proxy with Fallback
app.get('/api/market-data', async (req, res) => {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  };

  const timeout = 8000;

  let marketData: any = {
    'USD': { 'satis': '0', 'degisim': '0' },
    'EUR': { 'satis': '0', 'degisim': '0' },
    'GA': { 'satis': '0', 'degisim': '0' },
    'XU100': { 'satis': '0', 'degisim': '0' }
  };

  let usdFetched = false;
  let eurFetched = false;
  let gaFetched = false;

  // Helper to check if we have all data
  const isComplete = () => usdFetched && eurFetched && gaFetched;

  // Source 1: Open ER API (Very reliable for currencies)
  try {
    console.log('Attempting Source 1: Open ER API');
    const response = await fetch('https://open.er-api.com/v6/latest/TRY', { headers, signal: AbortSignal.timeout(timeout) });
    if (response.ok) {
      const data = await response.json();
      if (data && data.rates) {
        console.log('Source 1 Success (Currencies)');
        marketData['USD'].satis = (1 / data.rates.USD).toFixed(4);
        marketData['EUR'].satis = (1 / data.rates.EUR).toFixed(4);
        usdFetched = true;
        eurFetched = true;
      }
    }
  } catch (e) {
    console.error('Source 1 error:', e);
  }

  // Source 2: Truncgil (Turkish specific, good for Gold)
  try {
    console.log('Attempting Source 2: Truncgil');
    const response = await fetch('https://finans.truncgil.com/today.json', { headers, signal: AbortSignal.timeout(timeout) });
    if (response.ok) {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data) {
          console.log('Source 2 Success');
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
        }
      } catch (parseError) {
        console.error('Source 2 parse error:', parseError);
      }
    }
  } catch (e) {
    console.error('Source 2 error:', e);
  }

  // Source 3: Frankfurter (Currency Fallback)
  if (!usdFetched || !eurFetched) {
    try {
      console.log('Attempting Source 3: Frankfurter');
      const response = await fetch('https://api.frankfurter.app/latest?from=TRY&to=USD,EUR', { signal: AbortSignal.timeout(timeout) });
      if (response.ok) {
        const data = await response.json();
        if (data && data.rates) {
          console.log('Source 3 Success');
          if (!usdFetched) marketData['USD'].satis = (1 / data.rates.USD).toFixed(4);
          if (!eurFetched) marketData['EUR'].satis = (1 / data.rates.EUR).toFixed(4);
          usdFetched = true;
          eurFetched = true;
        }
      }
    } catch (e) {
      console.error('Source 3 error:', e);
    }
  }

  // Final Fallback for Gold if still zero
  if (marketData['GA'].satis === '0' || marketData['GA'].satis === 0) {
    console.log('Gold still zero, using mock fallback');
    marketData['GA'].satis = '3150.00';
    marketData['GA'].degisim = '0.65';
  }

  // If everything failed to get realistic data, use hardcoded mock as last resort (Updated for 2026)
  if (marketData['USD'].satis === '0' || marketData['GA'].satis === '0') {
    console.warn('Data incomplete, using hardcoded mock');
    return res.json({
      'USD': { 'satis': '44.59', 'degisim': '0.15' },
      'EUR': { 'satis': '48.25', 'degisim': '0.08' },
      'GA': { 'satis': '3150.00', 'degisim': '0.65' },
      'XU100': { 'satis': '10250.00', 'degisim': '0.45' },
      'BTC': { 'satis': '145000.00', 'degisim': '1.20' },
      'ETH': { 'satis': '4250.00', 'degisim': '0.85' },
      '_isMock': true
    });
  }

  res.json(marketData);
});

export default app;
