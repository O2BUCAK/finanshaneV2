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

  // Source 1: Open ER API (Very reliable)
  try {
    console.log('Attempting Source 1: Open ER API');
    const response = await fetch('https://open.er-api.com/v6/latest/TRY', { headers, signal: AbortSignal.timeout(timeout) });
    if (response.ok) {
      const data = await response.json();
      if (data && data.rates) {
        console.log('Source 1 Success');
        // Transform to match expected structure (Inverse because base is TRY)
        const transformed = {
          'USD': { 'satis': (1 / data.rates.USD).toFixed(4), 'degisim': '0' },
          'EUR': { 'satis': (1 / data.rates.EUR).toFixed(4), 'degisim': '0' },
          'GA': { 'satis': '0', 'degisim': '0' } // Gold not available here
        };
        return res.json(transformed);
      }
    }
    console.log(`Source 1 failed with status: ${response.status}`);
  } catch (e) {
    console.error('Source 1 error:', e);
  }

  // Source 2: ExchangeRate-API (Reliable)
  try {
    console.log('Attempting Source 2: ExchangeRate-API');
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/TRY', { headers, signal: AbortSignal.timeout(timeout) });
    if (response.ok) {
      const data = await response.json();
      if (data && data.rates) {
        console.log('Source 2 Success');
        const transformed = {
          'USD': { 'satis': (1 / data.rates.USD).toFixed(4), 'degisim': '0' },
          'EUR': { 'satis': (1 / data.rates.EUR).toFixed(4), 'degisim': '0' },
          'GA': { 'satis': '0', 'degisim': '0' }
        };
        return res.json(transformed);
      }
    }
    console.log(`Source 2 failed with status: ${response.status}`);
  } catch (e) {
    console.error('Source 2 error:', e);
  }

  // Source 3: Truncgil (Turkish specific)
  try {
    console.log('Attempting Source 3: Truncgil');
    const response = await fetch('https://finans.truncgil.com/today.json', { headers, signal: AbortSignal.timeout(timeout) });
    if (response.ok) {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data && (data.USD || data['USDOLLAR'])) {
          console.log('Source 3 Success');
          return res.json(data);
        }
      } catch (parseError) {
        console.error('Source 3 parse error:', parseError);
      }
    }
    console.log(`Source 3 failed with status: ${response.status}`);
  } catch (e) {
    console.error('Source 3 error:', e);
  }

  // Source 4: Frankfurter
  try {
    console.log('Attempting Source 4: Frankfurter');
    const response = await fetch('https://api.frankfurter.app/latest?from=TRY&to=USD,EUR', { signal: AbortSignal.timeout(timeout) });
    if (response.ok) {
      const data = await response.json();
      if (data && data.rates) {
        console.log('Source 4 Success');
        const transformed = {
          'USD': { 'satis': (1 / data.rates.USD).toFixed(4), 'degisim': '0' },
          'EUR': { 'satis': (1 / data.rates.EUR).toFixed(4), 'degisim': '0' },
          'GA': { 'satis': '0', 'degisim': '0' }
        };
        return res.json(transformed);
      }
    }
  } catch (e) {
    console.error('Source 4 error:', e);
  }

  // Final Fallback: Mock data if all else fails (to prevent UI crash)
  console.warn('All sources failed, returning mock data');
  res.json({
    'USD': { 'satis': '32.45', 'degisim': '0.12' },
    'EUR': { 'satis': '35.12', 'degisim': '-0.05' },
    'GA': { 'satis': '2450.00', 'degisim': '0.45' },
    '_isMock': true
  });
});

export default app;
