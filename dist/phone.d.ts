import { type CountryCode } from 'libphonenumber-js';
export declare const DEFAULT_PHONE_COUNTRY: CountryCode;
export type NormalizePhoneNumberOptions = {
    defaultCountry?: CountryCode | undefined;
};
export type NormalizedPhoneNumber = {
    status: 'empty';
} | {
    status: 'valid';
    e164: string;
} | {
    status: 'invalid';
    input: string;
};
export declare function normalizePhoneNumber(raw: string | null | undefined, options?: NormalizePhoneNumberOptions): NormalizedPhoneNumber;
export declare function normalizePhoneToE164(raw: string | null | undefined, options?: NormalizePhoneNumberOptions): string | null;
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
export declare function describePhoneInput(raw: string | null | undefined, options?: NormalizePhoneNumberOptions): PhoneInputParts;
/**
 * Builds a `+<callingCode><nationalNumber>` value from a country and the
 * digits of a national number (leading zeros and formatting are stripped) —
 * the inverse of {@link describePhoneInput} for split phone inputs.
 */
export declare function composePhoneNumber(country: CountryCode, nationalNumber: string): string;
/** Country calling code without the leading `+` (for example `countryCallingCode('DE') === '49'`). */
export declare function countryCallingCode(country: CountryCode): string;
