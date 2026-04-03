
/**
 * Türkiye Resmi Tatilleri 2026
 * 
 * 1 Ocak: Yılbaşı
 * 19 Mart: Ramazan Bayramı Arifesi (Yarım Gün)
 * 20 Mart: Ramazan Bayramı 1. Gün
 * 21 Mart: Ramazan Bayramı 2. Gün
 * 22 Mart: Ramazan Bayramı 3. Gün
 * 23 Nisan: Ulusal Egemenlik ve Çocuk Bayramı
 * 1 Mayıs: Emek ve Dayanışma Günü
 * 19 Mayıs: Atatürk'ü Anma, Gençlik ve Spor Bayramı
 * 26 Mayıs: Kurban Bayramı Arifesi (Yarım Gün)
 * 27 Mayıs: Kurban Bayramı 1. Gün
 * 28 Mayıs: Kurban Bayramı 2. Gün
 * 29 Mayıs: Kurban Bayramı 3. Gün
 * 30 Mayıs: Kurban Bayramı 4. Gün
 * 15 Temmuz: Demokrasi ve Milli Birlik Günü
 * 30 Ağustos: Zafer Bayramı
 * 28 Ekim: Cumhuriyet Bayramı Arifesi (Yarım Gün)
 * 29 Ekim: Cumhuriyet Bayramı
 */

export const TURKISH_HOLIDAYS = [
  // 2025
  "2025-01-01", // Yılbaşı
  "2025-03-30", // Ramazan Bayramı Arifesi
  "2025-03-31", // Ramazan Bayramı 1
  "2025-04-01", // Ramazan Bayramı 2
  "2025-04-02", // Ramazan Bayramı 3
  "2025-04-23", // Ulusal Egemenlik ve Çocuk Bayramı
  "2025-05-01", // Emek ve Dayanışma Günü
  "2025-05-19", // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  "2025-06-05", // Kurban Bayramı Arifesi
  "2025-06-06", // Kurban Bayramı 1
  "2025-06-07", // Kurban Bayramı 2
  "2025-06-08", // Kurban Bayramı 3
  "2025-06-09", // Kurban Bayramı 4
  "2025-07-15", // Demokrasi ve Milli Birlik Günü
  "2025-08-30", // Zafer Bayramı
  "2025-10-28", // Cumhuriyet Bayramı Arifesi
  "2025-10-29", // Cumhuriyet Bayramı

  // 2026
  "2026-01-01", // Yılbaşı
  "2026-03-19", // Ramazan Bayramı Arifesi
  "2026-03-20", // Ramazan Bayramı 1
  "2026-03-21", // Ramazan Bayramı 2
  "2026-03-22", // Ramazan Bayramı 3
  "2026-04-23", // Ulusal Egemenlik ve Çocuk Bayramı
  "2026-05-01", // Emek ve Dayanışma Günü
  "2026-05-19", // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  "2026-05-26", // Kurban Bayramı Arifesi
  "2026-05-27", // Kurban Bayramı 1
  "2026-05-28", // Kurban Bayramı 2
  "2026-05-29", // Kurban Bayramı 3
  "2026-05-30", // Kurban Bayramı 4
  "2026-07-15", // Demokrasi ve Milli Birlik Günü
  "2026-08-30", // Zafer Bayramı
  "2026-10-28", // Cumhuriyet Bayramı Arifesi
  "2026-10-29", // Cumhuriyet Bayramı
];

export const isHoliday = (date: Date): boolean => {
  // Adjust for local timezone to get the correct YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  return TURKISH_HOLIDAYS.includes(dateString);
};
