/**
 * Formats a numeric string or number into a Turkish-style currency format with thousand separators.
 * Example: 1000000 -> 1.000.000
 */
export const formatAmount = (value: string | number): string => {
  if (value === undefined || value === null || value === '') return '';
  
  // Convert to string and replace . with , for Turkish format
  let str = value.toString().replace(/\./g, ',');
  
  // Remove non-numeric characters except comma
  str = str.replace(/[^\d,]/g, '');

  const parts = str.split(',');
  // Add thousand separators to the integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Limit decimal part to 2 digits
  if (parts[1]) {
    parts[1] = parts[1].slice(0, 2);
  }
  
  return parts.join(',');
};

/**
 * Parses a formatted string back into a numeric string for state storage.
 * Example: 1.000.000,50 -> 1000000.50
 */
export const parseAmount = (value: string): string => {
  // Remove thousand separators (.) and replace decimal separator (,) with (.)
  return value.replace(/\./g, '').replace(',', '.');
};

/**
 * Cleans input to allow only digits and one decimal separator.
 */
export const cleanAmountInput = (value: string): string => {
  // Allow only digits and comma
  let cleaned = value.replace(/[^\d,]/g, '');
  
  // Ensure only one comma
  const parts = cleaned.split(',');
  if (parts.length > 2) {
    cleaned = parts[0] + ',' + parts.slice(1).join('');
  }
  
  return cleaned;
};
