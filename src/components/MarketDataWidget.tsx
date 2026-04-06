import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, Euro, Coins, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";

interface MarketData {
  [key: string]: {
    Buying?: string;
    Selling?: string;
    Satis?: string;
    satis?: string;
    Change?: string;
    Degisim?: string;
    degisim?: string;
  } | string;
}

export const MarketDataWidget: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [smartLoading, setSmartLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/market-data');
      const json = await response.json();
      console.log('Market data received:', json);
      setData(json);
      setLastUpdate(new Date().toLocaleTimeString('tr-TR'));
    } catch (error) {
      console.error('Market data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSmartData = async () => {
    setSmartLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Get the current USD/TRY, EUR/TRY exchange rates, Gram Gold (24K) price in TRY, BIST 100 Index (XU100), Bitcoin (BTC) price in USD, and Ethereum (ETH) price in USD from Google Finance. Return ONLY a JSON object with keys 'USD', 'EUR', 'GA', 'XU100', 'BTC', 'ETH' and subkeys 'satis' (price as string) and 'degisim' (percentage change as string). Example: {\"USD\": {\"satis\": \"44.59\", \"degisim\": \"+0.1\"}, ...}",
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (text) {
        const json = JSON.parse(text);
        setData({ ...json, _isSmart: true });
        setLastUpdate(new Date().toLocaleTimeString('tr-TR'));
      }
    } catch (error) {
      console.error('Smart fetch error:', error);
    } finally {
      setSmartLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000); // Standard update every 5 mins
    return () => clearInterval(interval);
  }, []);

  if (!data && loading) {
    return (
      <div className="corporate-card p-6 animate-pulse">
        <div className="h-4 w-32 bg-zinc-800 rounded mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-zinc-800 rounded-2xl" />
          <div className="h-20 bg-zinc-800 rounded-2xl" />
          <div className="h-20 bg-zinc-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  const items = [
    { label: 'USD/TRY', keys: ['USD', 'USDOLLAR'], icon: <DollarSign className="w-4 h-4" />, color: 'text-blue-500', prefix: '₺' },
    { label: 'EUR/TRY', keys: ['EUR', 'EURO'], icon: <Euro className="w-4 h-4" />, color: 'text-emerald-500', prefix: '₺' },
    { label: 'Gram Altın', keys: ['GA', 'gram-altin', 'GOLD'], icon: <Coins className="w-4 h-4" />, color: 'text-amber-500', prefix: '₺' },
    { label: 'BIST 100', keys: ['XU100', 'BIST100'], icon: <TrendingUp className="w-4 h-4" />, color: 'text-rose-500', prefix: '' },
    { label: 'Bitcoin', keys: ['BTC', 'BITCOIN'], icon: <TrendingUp className="w-4 h-4" />, color: 'text-orange-500', prefix: '$' },
    { label: 'Ethereum', keys: ['ETH', 'ETHEREUM'], icon: <TrendingUp className="w-4 h-4" />, color: 'text-indigo-500', prefix: '$' },
  ];

  return (
    <div className="corporate-card p-6 relative group">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <TrendingUp className="w-5 h-5" />
          <span className="font-semibold uppercase tracking-wider text-xs">Canlı Piyasa Verileri</span>
        </div>
        <div className="flex items-center gap-3">
          {data?._isMock && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[8px] font-bold uppercase tracking-tighter border border-amber-500/20">
              Simüle Edildi
            </span>
          )}
          {data?._isSmart && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[8px] font-bold uppercase tracking-tighter border border-blue-500/20 flex items-center gap-1">
              <Search className="w-2 h-2" /> Google Finans
            </span>
          )}
          <span className="text-[10px] text-zinc-500 font-medium">Son Güncelleme: {lastUpdate}</span>
          <div className="flex items-center gap-1">
            <button 
              onClick={fetchSmartData} 
              disabled={smartLoading}
              title="Google Finans'tan Güncelle"
              className={`p-1.5 hover:bg-blue-500/10 rounded-lg transition-colors ${smartLoading ? 'animate-pulse text-blue-500' : 'text-zinc-400'}`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={fetchData} 
              disabled={loading}
              title="Standart Güncelleme"
              className={`p-1.5 hover:bg-zinc-800 rounded-lg transition-colors ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {items.map((item) => {
          // Try all possible keys for this item
          let marketItem = null;
          for (const key of item.keys) {
            if (data?.[key]) {
              marketItem = data[key];
              break;
            }
          }
          
          if (!marketItem) return null;

          // Handle different possible key names from the API
          let selling = marketItem.Selling || marketItem.Satis || marketItem.satis || (typeof marketItem === 'string' ? marketItem : '0');
          
          // Clean up formatting if it's a string
          if (typeof selling === 'string') {
            selling = selling.replace('₺', '').replace('$', '').trim();
          }

          const priceValue = parseFloat(String(selling).replace(',', '.'));
          const formattedValue = isNaN(priceValue) 
            ? selling 
            : new Intl.NumberFormat('tr-TR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: item.label.includes('Bitcoin') || item.label.includes('Ethereum') ? 2 : 2 
              }).format(priceValue);
          
          const formattedPrice = `${item.prefix} ${formattedValue}`;

          const change = marketItem.Change || marketItem.Degisim || marketItem.degisim || '0';
          const isUp = !String(change).startsWith('-');

          return (
            <div key={item.label} className="p-4 rounded-2xl bg-secondary/30 border border-border/50 hover:border-primary/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className={`flex items-center gap-2 ${item.color}`}>
                  {item.icon}
                  <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                </div>
                <div className={`flex items-center gap-0.5 text-[10px] font-bold ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {change}%
                </div>
              </div>
              <div className="text-xl font-bold text-foreground tracking-tight">
                {formattedPrice}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-zinc-600 mt-4 text-center italic">
        * Veriler canlı piyasa kaynaklarından sağlanmaktadır. Yatırım tavsiyesi değildir.
      </p>
    </div>
  );
};
