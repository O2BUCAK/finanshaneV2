import { z } from 'zod';

export const TcmbCurrencySchema = z.object({
  code: z.string().min(2).max(5),
  name: z.string(),
  forexBuying: z.number().nonnegative(),
  forexSelling: z.number().nonnegative(),
  banknoteBuying: z.number().nonnegative().optional(),
  banknoteSelling: z.number().nonnegative().optional(),
});

export const CryptoTrTickerSchema = z.object({
  symbol: z.string().min(2).max(10),
  exchange: z.enum(['BtcTurk', 'Paribu']),
  lastPrice: z.number().nonnegative(),
  dailyChange: z.number(),
  high24h: z.number().optional(),
  low24h: z.number().optional(),
});

export const GoldRateSchema = z.object({
  code: z.string(),
  name: z.string(),
  buying: z.number().nonnegative(),
  selling: z.number().nonnegative(),
  changePercent: z.number(),
});

export const TefasFundSchema = z.object({
  code: z.string().min(3).max(7),
  title: z.string(),
  price: z.number().nonnegative(),
  dailyReturn: z.number(),
  category: z.string().optional(),
});

export const MarketDataFeedSchema = z.record(
  z.string(),
  z.object({
    satis: z.union([z.string(), z.number()]),
    degisim: z.union([z.string(), z.number()]).optional(),
  })
);

export type ValidatedTcmbCurrency = z.infer<typeof TcmbCurrencySchema>;
export type ValidatedCryptoTrTicker = z.infer<typeof CryptoTrTickerSchema>;
export type ValidatedGoldRate = z.infer<typeof GoldRateSchema>;
export type ValidatedTefasFund = z.infer<typeof TefasFundSchema>;
export type ValidatedMarketData = z.infer<typeof MarketDataFeedSchema>;
