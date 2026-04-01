import { useState, useEffect } from 'react';

interface ExchangeRates {
  TRY: number;
  USD: number;
  EUR: number;
  [key: string]: number;
}

export const useExchangeRates = (isPrivacyMode: boolean = false) => {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const maskValue = (value: string) => {
    if (!isPrivacyMode) return value;
    return '••••••';
  };

  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Using ExchangeRate-API (free tier, no key required, base USD)
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!response.ok) {
          throw new Error('Failed to fetch exchange rates');
        }
        const data = await response.json();
        setRates(data.rates);
        setError(null);
      } catch (err) {
        console.error('Exchange rate fetch error:', err);
        setError('Döviz kurları alınamadı.');
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
    
    // Refresh rates every hour
    const interval = setInterval(fetchRates, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const convertToTRY = (amount: number, currency: string) => {
    if (!rates || currency === 'TRY') return amount;
    
    // If currency is USD, we just multiply by TRY rate
    if (currency === 'USD') {
      return amount * rates.TRY;
    }
    
    // If currency is EUR, we convert EUR to USD, then to TRY
    // EUR to USD = 1 / rates.EUR
    // EUR to TRY = (1 / rates.EUR) * rates.TRY = rates.TRY / rates.EUR
    if (currency === 'EUR') {
      return amount * (rates.TRY / rates.EUR);
    }

    return amount;
  };

  const formatWithEquivalent = (amount: number, currency: string) => {
    if (isPrivacyMode) return '••••••';

    const formattedOriginal = new Intl.NumberFormat('tr-TR', { 
      style: 'currency', 
      currency: currency,
      maximumFractionDigits: amount < 1 && amount !== 0 ? 8 : 2
    }).format(amount);

    if (currency === 'TRY' || !rates) {
      return formattedOriginal;
    }

    const tryEquivalent = convertToTRY(amount, currency);
    const formattedTRY = new Intl.NumberFormat('tr-TR', { 
      style: 'currency', 
      currency: 'TRY',
      maximumFractionDigits: 0
    }).format(tryEquivalent);

    return `${formattedOriginal} (~${formattedTRY})`;
  };

  return { rates, loading, error, convertToTRY, formatWithEquivalent };
};
