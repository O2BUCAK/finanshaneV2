import { useState, useEffect } from 'react';

interface AssetPrice {
  symbol: string;
  price: number;
  currency: string;
  changePercent: number;
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
              const data = await res.json();
              if (data.lastPrice) {
                newPrices[symbol] = {
                  symbol,
                  price: parseFloat(data.lastPrice),
                  currency: 'USD',
                  changePercent: parseFloat(data.priceChangePercent)
                };
              }
            } catch (e) {
              console.error(`Error fetching crypto ${symbol}:`, e);
            }
          } else if (type === 'stock') {
            try {
              const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.IS`)}`);
              const data = await res.json();
              const parsed = JSON.parse(data.contents);
              const result = parsed.chart.result[0];
              const meta = result.meta;
              newPrices[symbol] = {
                symbol,
                price: meta.regularMarketPrice,
                currency: meta.currency || 'TRY',
                changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
              };
            } catch (e) {
              console.error(`Error fetching stock ${symbol}:`, e);
            }
          }
          // Funds (TEFAS) are harder to fetch without a specific API, we might skip or mock for now
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
