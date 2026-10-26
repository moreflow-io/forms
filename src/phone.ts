import {
  AsYouType,
  type CountryCode,
  getCountryCallingCode,
  Metadata,
  type NumberingPlan,
  type PhoneNumber,
  parsePhoneNumberFromString
} from 'libphonenumber-js';

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'DE';

export type NormalizePhoneNumberOptions = {
  defaultCountry?: CountryCode | undefined;
};

export type NormalizedPhoneNumber =
  | { status: 'empty' }
  | { status: 'valid'; e164: string }
  | { status: 'invalid'; input: string };

/**
 * Normalizes a raw phone number into E.164. National numbers ("0151...")
 * are interpreted against `defaultCountry` (Germany unless specified).
 *
 * Where domestic numbers start with the trunk prefix "0" (DE, AT, CH, GB, …),
 * digits without "+", "00" or a leading "0" that begin with the country's own
 * calling code ("49 152 21322502") are read as international: reading them
 * nationally doubles the code into a different, still valid-looking number
 * (+49 491…). Other bare digits ("170 1234567") keep the national reading.
 * A number that already carries the doubled code ("+49 49 152…") is repaired
 * by {@link withoutDoubledCountryCode}.
 */
export function normalizePhoneNumber(
  raw: string | null | undefined,
  options: NormalizePhoneNumberOptions = {}
): NormalizedPhoneNumber {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || trimmed === '+') return { status: 'empty' };

  const defaultCountry = options.defaultCountry ?? DEFAULT_PHONE_COUNTRY;
  const ownCountryCode = parseBareOwnCountryCode(trimmed, defaultCountry);
  if (ownCountryCode) return { status: 'valid', e164: ownCountryCode };

  // extract: false rejects phone numbers embedded in surrounding prose; only
  // an input that is entirely one phone number (plus formatting) is valid.
  const parsed = parsePhoneNumberFromString(trimmed, {
    defaultCountry,
    extract: false
  });
  if (!parsed?.isValid()) return { status: 'invalid', input: trimmed };
  return { status: 'valid', e164: withoutDoubledCountryCode(parsed) };
}

function parseBareOwnCountryCode(trimmed: string, country: CountryCode): string | undefined {
  const digits = trimmed.replace(/[^\d]/g, '');
  if (
    trimmed.startsWith('+') ||
    digits.startsWith('0') ||
    !digits.startsWith(getCountryCallingCode(country)) ||
    nationalTrunkPrefix(country) !== '0'
  ) {
    return undefined;
  }
  // Prose around the digits ("call me at 4915…") is not a bare number, so the
  // whole input must still be one phone number under extract: false.
  if (!parsePhoneNumberFromString(trimmed, { defaultCountry: country, extract: false })) {
    return undefined;
  }
  const parsed = parsePhoneNumberFromString(`+${digits}`, { extract: false });
  return parsed?.isValid() ? parsed.number : undefined;
}

/**
 * Mobile national numbers per country calling code, for spotting a calling
 * code typed twice. libphonenumber's bundled metadata carries no number types,
 * so the ranges are explicit: German mobile numbers are 015x, 016x and 017x.
 */
const doubledCountryCodeMobileRanges: Partial<Record<string, RegExp>> = {
  '49': /^1[5-7]\d{8,9}$/
};

/**
 * A lead typing "49 152 21322502" into a phone field already set to Germany
 * submits "+49 49 152…": a valid-looking number in Leer (0491) that carriers
 * reject as unassigned. When the national number repeats the calling code and
 * the rest is a valid mobile number, the repeat is dropped. Only mobile
 * remainders qualify, so real numbers in the 049x area codes (Leer, Emden,
 * Aurich, …) are kept.
 */
function withoutDoubledCountryCode(parsed: PhoneNumber): string {
  const callingCode = parsed.countryCallingCode;
  const mobileRange = doubledCountryCodeMobileRanges[callingCode];
  if (!mobileRange || !parsed.nationalNumber.startsWith(callingCode)) return parsed.number;
  const remainder = parsed.nationalNumber.slice(callingCode.length);
  if (!mobileRange.test(remainder)) return parsed.number;
  const corrected = parsePhoneNumberFromString(`+${callingCode}${remainder}`);
  return corrected?.isValid() ? corrected.number : parsed.number;
}

function nationalTrunkPrefix(country: CountryCode): string | undefined {
  const metadata = new Metadata();
  metadata.selectNumberingPlan(country);
  // The published NumberingPlan type omits nationalPrefix(), which the runtime class provides.
  const plan = metadata.numberingPlan as
    | (NumberingPlan & { nationalPrefix?: () => string | undefined })
    | undefined;
  return plan?.nationalPrefix?.() || undefined;
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
