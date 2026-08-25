import {
  AsYouType,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode
} from 'libphonenumber-js';

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'DE';

export type NormalizePhoneNumberOptions = {
  defaultCountry?: CountryCode | undefined;
};

export type NormalizedPhoneNumber =
  | { status: 'empty' }
  | { status: 'valid'; e164: string }
  | { status: 'invalid'; input: string };

export function normalizePhoneNumber(
  raw: string | null | undefined,
  options: NormalizePhoneNumberOptions = {}
): NormalizedPhoneNumber {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || trimmed === '+') return { status: 'empty' };

  // extract: false rejects phone numbers embedded in surrounding prose; only
  // an input that is entirely one phone number (plus formatting) is valid.
  const parsed = parsePhoneNumberFromString(trimmed, {
    defaultCountry: options.defaultCountry ?? DEFAULT_PHONE_COUNTRY,
    extract: false
  });
  if (!parsed?.isValid()) return { status: 'invalid', input: trimmed };
  return { status: 'valid', e164: parsed.number };
}

export function normalizePhoneToE164(
  raw: string | null | undefined,
  options: NormalizePhoneNumberOptions = {}
): string | null {
  const result = normalizePhoneNumber(raw, options);
  return result.status === 'valid' ? result.e164 : null;
}

export interface PhoneInputParts {
  /** Detected country, or the default country for national input; undefined for an unrecognized international prefix. */
  country: CountryCode | undefined;
  /** Country calling code without the leading `+` (for example `"49"`). */
  callingCode: string | undefined;
  /** National significant number typed so far (no calling code, no leading zero). */
  nationalNumber: string;
  /** E.164 value once the input is a complete, valid number. */
  e164: string | undefined;
  isValid: boolean;
}

/**
 * Decomposes a (possibly partial) phone input into country, calling code, and
 * national number, for building split country-selector + number inputs without
 * hand-rolled dial-code tables. Accepts `00` international prefixes and
 * numbers with or without a `+`; national input is interpreted against
 * `defaultCountry` (default `'DE'`).
 */
export function describePhoneInput(
  raw: string | null | undefined,
  options: NormalizePhoneNumberOptions = {}
): PhoneInputParts {
  const trimmed = raw?.trim() ?? '';
  const input = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed;
  const defaultCountry = options.defaultCountry ?? DEFAULT_PHONE_COUNTRY;
  const international = input.startsWith('+');

  const formatter = new AsYouType(defaultCountry);
  formatter.input(input);
  const parsed = formatter.getNumber();

  const country =
    parsed?.country ?? formatter.getCountry() ?? (international ? undefined : defaultCountry);
  const callingCode =
    parsed?.countryCallingCode ??
    formatter.getCallingCode() ??
    (country ? getCountryCallingCode(country) : undefined);
  const nationalNumber = (parsed?.nationalNumber ?? '').replace(/^0+/u, '');
  const isValid = parsed?.isValid() ?? false;

  return {
    country,
    callingCode,
    nationalNumber,
    e164: isValid && parsed ? parsed.number : undefined,
    isValid
  };
}

/**
 * Builds a `+<callingCode><nationalNumber>` value from a country and the
 * digits of a national number (leading zeros and formatting are stripped) —
 * the inverse of {@link describePhoneInput} for split phone inputs.
 */
export function composePhoneNumber(country: CountryCode, nationalNumber: string): string {
  const digits = nationalNumber.replace(/\D+/gu, '').replace(/^0+/u, '');
  return `+${getCountryCallingCode(country)}${digits}`;
}

/** Country calling code without the leading `+` (for example `countryCallingCode('DE') === '49'`). */
export function countryCallingCode(country: CountryCode): string {
  return getCountryCallingCode(country);
}
