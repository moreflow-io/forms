import { describe, expect, it } from 'vitest';
import { composePhoneNumber, countryCallingCode, describePhoneInput } from './index';

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
