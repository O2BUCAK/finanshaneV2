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
        // Try official TCMB XML endpoint first
        const tcmbRes = await fetch('/api/tcmb-rates');
        if (tcmbRes.ok) {
          const tcmbData = await tcmbRes.json();
          if (tcmbData.rates && tcmbData.rates.USD) {
            const usdTry = tcmbData.rates.USD.forexSelling || tcmbData.rates.USD.forexBuying || 44.59;
            const eurTry = tcmbData.rates.EUR ? (tcmbData.rates.EUR.forexSelling || 48.25) : 48.25;
            setRates({
              TRY: usdTry,
              USD: 1,
              EUR: usdTry / eurTry,
            });
            setError(null);
            setLoading(false);
            return;
          }
        }

        // Fallback: Using ExchangeRate-API (free tier, base USD)
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

  const formatWithEquivalent = (amount: number, currency: string, overridePrivacy?: boolean) => {
    const effectivePrivacy = overridePrivacy !== undefined ? overridePrivacy : isPrivacyMode;
    if (effectivePrivacy) return '••••••';

    const formatter = new Intl.NumberFormat('tr-TR', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: amount < 1 && amount !== 0 ? 8 : 2
    });

    const formattedValue = formatter.format(amount);
    const symbol = currency === 'TRY' ? '₺' : (currency === 'USD' ? '$' : (currency === 'EUR' ? '€' : currency));
    
    // Add a space between symbol and value for better readability
    const formattedOriginal = `${symbol} ${formattedValue}`;

    if (currency === 'TRY' || !rates) {
      return formattedOriginal;
    }

    const tryEquivalent = convertToTRY(amount, currency);
    const tryFormatter = new Intl.NumberFormat('tr-TR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    const formattedTRY = `₺ ${tryFormatter.format(tryEquivalent)}`;

    return `${formattedOriginal} (~${formattedTRY})`;
  };

  return { rates, loading, error, convertToTRY, formatWithEquivalent };
};
