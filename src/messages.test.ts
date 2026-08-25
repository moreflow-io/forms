import { describe, expect, it } from 'vitest';
import { formMessageId, isFormMessageKey, resolveFormMessage } from './index';

describe('form message resolution', () => {
  it('resolves persisted dotted keys to default German and English copy', () => {
    expect(resolveFormMessage('forms.defaults.first_name.label')).toBe('Vorname');
    expect(resolveFormMessage('forms.defaults.first_name.label', { language: 'en' })).toBe(
      'First name'
    );
    expect(resolveFormMessage('forms.defaults.dropdown.placeholder')).toBe('Auswählen');
    expect(resolveFormMessage('forms.settings.submitButton')).toBe('Absenden');
  });

  it('normalizes camelCase key segments the way the hosted renderer does', () => {
    expect(formMessageId('forms.privacy.iAgree')).toBe('forms_privacy_i_agree');
    expect(resolveFormMessage('forms.privacy.iAgree')).toBe('Ich stimme zu.');
    expect(resolveFormMessage('forms.privacy.iAgree', { language: 'en' })).toBe('I agree.');
  });

  it('passes literal label text through unchanged', () => {
    expect(isFormMessageKey('Firmenname')).toBe(false);
    expect(resolveFormMessage('Firmenname')).toBe('Firmenname');
    expect(resolveFormMessage(undefined)).toBe('');
  });

  it('returns unknown forms.* keys unchanged instead of guessing', () => {
    expect(resolveFormMessage('forms.defaults.unknown_field.label')).toBe(
      'forms.defaults.unknown_field.label'
    );
  });

  it('interpolates {param} tokens', () => {
    expect(
      resolveFormMessage('forms.privacy.consentLabel', {
        language: 'en',
        params: { companyName: 'ACME GmbH' }
      })
    ).toContain('ACME GmbH');
  });
});
