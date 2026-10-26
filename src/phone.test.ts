import { describe, expect, it } from 'vitest';
import {
  composePhoneNumber,
  countryCallingCode,
  describePhoneInput,
  normalizePhoneNumber
} from './index';

describe('normalizePhoneNumber', () => {
  it('reads a bare German country code as international, not as a doubled national number', () => {
    expect(normalizePhoneNumber('49 152 21322502')).toEqual({
      status: 'valid',
      e164: '+4915221322502'
    });
    expect(normalizePhoneNumber('4915221322502')).toEqual({
      status: 'valid',
      e164: '+4915221322502'
    });
  });

  it('drops a calling code typed twice when the rest is a German mobile number', () => {
    for (const raw of ['+49 49 152 21322502', '+494915221322502', '00494915221322502']) {
      expect(normalizePhoneNumber(raw)).toEqual({ status: 'valid', e164: '+4915221322502' });
    }
    expect(normalizePhoneNumber('+49491742618237')).toEqual({
      status: 'valid',
      e164: '+491742618237'
    });
  });

  it('keeps real numbers in the 049x area codes', () => {
    for (const e164 of ['+4949112345', '+49491929001234', '+494917123456', '+4949217654321']) {
      expect(normalizePhoneNumber(e164)).toEqual({ status: 'valid', e164 });
    }
  });

  it('keeps the national reading for bare digits that do not start with the country code', () => {
    expect(normalizePhoneNumber('1701234567')).toEqual({
      status: 'valid',
      e164: '+491701234567'
    });
  });

  it('normalizes trunk-prefixed, plus and 00-prefixed input to the same number', () => {
    for (const raw of ['015221322502', '+4915221322502', '004915221322502']) {
      expect(normalizePhoneNumber(raw)).toEqual({ status: 'valid', e164: '+4915221322502' });
    }
  });

  it('reads national input against the given default country', () => {
    expect(normalizePhoneNumber('2025550123', { defaultCountry: 'US' })).toEqual({
      status: 'valid',
      e164: '+12025550123'
    });
  });

  it('rejects phone numbers embedded in prose (extract: false)', () => {
    expect(normalizePhoneNumber('call me at +49 170 1234567')).toEqual({
      status: 'invalid',
      input: 'call me at +49 170 1234567'
    });
  });
});

describe('describePhoneInput', () => {
  it('decomposes a full international number', () => {
    expect(describePhoneInput('+49 170 1234567')).toEqual({
      country: 'DE',
      callingCode: '49',
      nationalNumber: '1701234567',
      e164: '+491701234567',
      isValid: true
    });
  });

  it('accepts 00-prefixed international input', () => {
    expect(describePhoneInput('0031 6 12345678')).toMatchObject({
      country: 'NL',
      callingCode: '31',
      e164: '+31612345678',
      isValid: true
    });
  });

  it('interprets national input against the default country and strips the trunk zero', () => {
    const parts = describePhoneInput('0170 1234567');
    expect(parts).toMatchObject({
      country: 'DE',
      callingCode: '49',
      nationalNumber: '1701234567',
      e164: '+491701234567'
    });

    expect(describePhoneInput('06 12345678', { defaultCountry: 'NL' })).toMatchObject({
      country: 'NL',
      e164: '+31612345678'
    });
  });

  it('reports partial input without a valid number', () => {
    expect(describePhoneInput('+49 17')).toMatchObject({
      callingCode: '49',
      e164: undefined,
      isValid: false
    });
    expect(describePhoneInput('')).toMatchObject({
      country: 'DE',
      callingCode: '49',
      nationalNumber: '',
      isValid: false
    });
  });
});

describe('composePhoneNumber', () => {
  it('builds a +<callingCode><national> value and strips trunk zeros and formatting', () => {
    expect(composePhoneNumber('DE', '0170 123-4567')).toBe('+491701234567');
    expect(countryCallingCode('AT')).toBe('43');
  });
});
