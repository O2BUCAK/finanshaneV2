import { useState, useEffect } from 'react';

interface AssetPrice {
  symbol: string;
  price: number;
  currency: string;
  changePercent: number;
}

function safeParse(str: string) {
  if (!str || typeof str !== 'string') return null;
  try {
    return JSON.parse(str);
  } catch (_) {
    try {
      const lastCurly = str.lastIndexOf('}');
      if (lastCurly > 0) {
        return JSON.parse(str.slice(0, lastCurly + 1));
      }
    } catch (__) {}
    return null;
  }
}

export const useAssetPrices = (symbols: { symbol: string; type: 'stock' | 'crypto' | 'fund' }[]) => {
  const [prices, setPrices] = useState<Record<string, AssetPrice>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbols.length === 0) return;

    const fetchPrices = async () => {
      setLoading(true);
      const newPrices: Record<string, AssetPrice> = {};

      try {
        for (const { symbol, type } of symbols) {
          if (type === 'crypto') {
            try {
              const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
              if (res.ok) {
                const data = await res.json();
                if (data.lastPrice) {
                  newPrices[symbol] = {
                    symbol,
                    price: parseFloat(data.lastPrice),
                    currency: 'USD',
                    changePercent: parseFloat(data.priceChangePercent)
                  };
                }
              } else if (symbol === 'EXEN') {
                const bitexenRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://www.bitexen.com/api/v1/ticker/EXEN/')}`);
                const bitexenData = await bitexenRes.json();
                const parsed = safeParse(bitexenData.contents);
                if (parsed && parsed.status === 'success' && parsed.data?.ticker) {
                  const ticker = parsed.data.ticker;
                  newPrices[symbol] = {
                    symbol,
                    price: parseFloat(ticker.last_price),
                    currency: 'TRY',
                    changePercent: parseFloat(ticker.change_24h)
                  };
                }
              }
            } catch (e) {
              console.warn(`Could not fetch price for crypto ${symbol}`);
            }
          } else if (type === 'stock') {
            try {
              // Try Yahoo Finance via AllOrigins proxy
              const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.IS`;
              const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`);
              
              if (res.ok) {
                const data = await res.json();
                const parsed = safeParse(data.contents);
                if (parsed?.chart?.result?.[0]) {
                  const result = parsed.chart.result[0];
                  const meta = result.meta;
                  newPrices[symbol] = {
                    symbol,
                    price: meta.regularMarketPrice,
                    currency: meta.currency || 'TRY',
                    changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
                  };
                  continue;
                }
              }

              // Fallback proxy: Corsproxy.io
              const fallbackRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(yahooUrl)}`);
              if (fallbackRes.ok) {
                const parsed = await fallbackRes.json();
                if (parsed?.chart?.result?.[0]) {
                  const result = parsed.chart.result[0];
                  const meta = result.meta;
                  newPrices[symbol] = {
                    symbol,
                    price: meta.regularMarketPrice,
                    currency: meta.currency || 'TRY',
                    changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
                  };
                }
              }
            } catch (e) {
              console.warn(`Could not fetch price for stock ${symbol}`);
            }
          } else if (type === 'fund') {
            try {
              const res = await fetch(`/api/tefas-funds?code=${encodeURIComponent(symbol)}`);
              if (res.ok) {
                const data = await res.json();
                if (data.fund) {
                  newPrices[symbol] = {
                    symbol,
                    price: data.fund.price,
                    currency: 'TRY',
                    changePercent: data.fund.dailyReturn
                  };
                }
              }
            } catch (e) {
              console.warn(`Could not fetch price for fund ${symbol}`);
            }
          }
        }
        setPrices(prev => ({ ...prev, ...newPrices }));
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    // Refresh every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [JSON.stringify(symbols)]);

  return { prices, loading };
};
