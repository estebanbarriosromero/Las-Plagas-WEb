/**
 * Validador oficial de tarjetas de pago bancarias reales (Visa, Mastercard, Amex, Maestro)
 * Incluye algoritmo de Luhn (ISO/IEC 7812), detección de emisor, caducidad y CVC.
 */

export type CardBrandType = 'visa' | 'mastercard' | 'amex' | 'maestro' | 'discover' | 'unknown';

export interface CardBrandInfo {
  brand: CardBrandType;
  name: string;
  badgeColor: string;
  textColor: string;
  expectedLengths: number[];
  cvcLength: number;
}

export function detectCardBrand(cardNumber: string): CardBrandInfo {
  const clean = cardNumber.replace(/\D/g, '');

  // American Express: 34 o 37 (15 dígitos, CVC 4 dígitos)
  if (/^3[47]/.test(clean)) {
    return {
      brand: 'amex',
      name: 'American Express',
      badgeColor: 'bg-[#002663]',
      textColor: 'text-white',
      expectedLengths: [15],
      cvcLength: 4,
    };
  }

  // Visa: empieza por 4 (16 dígitos, CVC 3 dígitos)
  if (/^4/.test(clean)) {
    return {
      brand: 'visa',
      name: 'Visa',
      badgeColor: 'bg-[#1a1f71]',
      textColor: 'text-white',
      expectedLengths: [16],
      cvcLength: 3,
    };
  }

  // Mastercard: 51-55 o 2221-2720 (16 dígitos, CVC 3 dígitos)
  if (/^(5[1-5]|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)/.test(clean)) {
    return {
      brand: 'mastercard',
      name: 'Mastercard',
      badgeColor: 'bg-[#eb001b]',
      textColor: 'text-white',
      expectedLengths: [16],
      cvcLength: 3,
    };
  }

  // Maestro: 50, 56-58, 6...
  if (/^(5018|5020|5038|5893|6304|6759|6761|6762|6763|60)/.test(clean)) {
    return {
      brand: 'maestro',
      name: 'Maestro / Euro6000',
      badgeColor: 'bg-[#0099df]',
      textColor: 'text-white',
      expectedLengths: [16, 18, 19],
      cvcLength: 3,
    };
  }

  // Discover: 6011, 622126-622925, 644-649, 65
  if (/^(6011|65|64[4-9]|622)/.test(clean)) {
    return {
      brand: 'discover',
      name: 'Discover',
      badgeColor: 'bg-[#ff6000]',
      textColor: 'text-white',
      expectedLengths: [16],
      cvcLength: 3,
    };
  }

  return {
    brand: 'unknown',
    name: 'Tarjeta Bancaria',
    badgeColor: 'bg-gray-800',
    textColor: 'text-white',
    expectedLengths: [15, 16],
    cvcLength: 3,
  };
}

/**
 * Formatea el número de tarjeta con espacios según el tipo de tarjeta:
 * - Amex: 4-6-5 (ej. 3782 822463 10005)
 * - Resto: 4-4-4-4 (ej. 4532 1234 5678 9010)
 */
export function formatCardNumber(value: string): string {
  const clean = value.replace(/\D/g, '');
  const brandInfo = detectCardBrand(clean);

  if (brandInfo.brand === 'amex') {
    const limited = clean.slice(0, 15);
    const p1 = limited.slice(0, 4);
    const p2 = limited.slice(4, 10);
    const p3 = limited.slice(10, 15);
    return [p1, p2, p3].filter(Boolean).join(' ');
  }

  const limited = clean.slice(0, 19);
  const groups = limited.match(/.{1,4}/g);
  return groups ? groups.join(' ') : limited;
}

/**
 * Algoritmo de Luhn (ISO/IEC 7812): valida la suma de comprobación del número de tarjeta real
 */
export function validateLuhn(cardNumber: string): boolean {
  const clean = cardNumber.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (isNaN(digit)) return false;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Valida la fecha de caducidad (MM/AA)
 */
export function validateCardExpiry(expiry: string): { isValid: boolean; message?: string } {
  const clean = expiry.replace(/\s/g, '');
  if (!/^\d{2}\/\d{2}$/.test(clean)) {
    return { isValid: false, message: 'Introduce la fecha en formato MM/AA (ej: 08/28)' };
  }

  const [mStr, yStr] = clean.split('/');
  const month = parseInt(mStr, 10);
  const year = parseInt('20' + yStr, 10);

  if (month < 1 || month > 12) {
    return { isValid: false, message: 'El mes de caducidad debe estar entre 01 y 12' };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { isValid: false, message: 'La tarjeta está caducada' };
  }

  if (year > currentYear + 20) {
    return { isValid: false, message: 'Año de caducidad no válido' };
  }

  return { isValid: true };
}

/**
 * Valida el código CVC / CVV
 */
export function validateCardCvc(cvc: string, brand: CardBrandType): { isValid: boolean; message?: string } {
  const clean = cvc.replace(/\D/g, '');
  const expectedLen = brand === 'amex' ? 4 : 3;

  if (clean.length !== expectedLen) {
    return {
      isValid: false,
      message:
        brand === 'amex'
          ? 'El código CID de American Express tiene 4 dígitos (en el frontal)'
          : 'El código CVV/CVC tiene 3 dígitos (en el reverso)',
    };
  }

  return { isValid: true };
}

/**
 * Valida el titular de la tarjeta
 */
export function validateCardholder(holder: string): { isValid: boolean; message?: string } {
  const trimmed = holder.trim();
  if (trimmed.length < 3) {
    return { isValid: false, message: 'Introduce el nombre y apellidos del titular de la tarjeta' };
  }
  if (/\d/.test(trimmed)) {
    return { isValid: false, message: 'El nombre del titular no puede contener números' };
  }
  return { isValid: true };
}
