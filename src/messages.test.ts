import { describe, expect, it } from 'vitest';
import {
  formMessageCatalogs,
  formMessageId,
  isFormMessageKey,
  marketingConsentText,
  resolveFormMessage,
  validationMessage
} from './index';

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

  it('keeps the privacy acknowledgement free of any marketing sentence', () => {
    expect(
      resolveFormMessage('forms.privacy.consentLabel', { params: { companyName: 'ACME GmbH' } })
    ).toBe(
      'Ich bin damit einverstanden, dass die ACME GmbH meine persönlichen Daten zur Verwaltung und zur Bereitstellung der von mir angeforderten Dienstleistungen speichert.'
    );
    expect(
      resolveFormMessage('forms.privacy.consentLabel', {
        language: 'en',
        params: { companyName: 'ACME GmbH' }
      })
    ).toBe(
      'I agree that ACME GmbH may store my personal data for managing and providing the services I have requested.'
    );
  });

  it('resolves the default labels of the consent field types', () => {
    expect(resolveFormMessage('forms.defaults.marketing_consent.label')).toBe('Marketing-Einwilligung');
    expect(resolveFormMessage('forms.types.marketing_consent', { language: 'en' })).toBe(
      'Marketing consent (optional)'
    );
    expect(resolveFormMessage('forms.defaults.tracking_consent.label', { language: 'en' })).toBe(
      'Email tracking consent'
    );
  });
});

describe('marketingConsentText', () => {
  it('names the company in the requested language, German by default', () => {
    expect(marketingConsentText({ companyName: 'ACME GmbH' })).toBe(
      'Ich möchte Neuigkeiten und Angebote von ACME GmbH per E-Mail erhalten. Diese Einwilligung kann ich jederzeit widerrufen.'
    );
    expect(marketingConsentText({ companyName: '  ACME GmbH ', language: 'en' })).toBe(
      'I would like to receive news and offers from ACME GmbH by email. I can withdraw this consent at any time.'
    );
  });

  it('returns undefined without a company name, so the box stays hidden', () => {
    expect(marketingConsentText({ companyName: undefined })).toBeUndefined();
    expect(marketingConsentText({ companyName: null, language: 'en' })).toBeUndefined();
    expect(marketingConsentText({ companyName: '   ' })).toBeUndefined();
  });

  it('is not a persisted forms.* key, so resolveFormMessage leaves the id alone', () => {
    expect(isFormMessageKey('public_marketing_consent_label')).toBe(false);
    expect(formMessageCatalogs.en.public_marketing_consent_label).toContain('{companyName}');
  });
});

describe('copy overrides and formality', () => {
  it('lets messages.forms replace a key by its dotted key or message id', () => {
    const messages = {
      forms: {
        'forms.settings.submitButton': 'Kostenlos anfragen',
        forms_defaults_first_name_placeholder: 'Dein Vorname',
        'forms.privacy.consentLabel': 'Ja, {companyName} darf mich kontaktieren.'
      }
    };

    expect(resolveFormMessage('forms.settings.submitButton', { messages })).toBe('Kostenlos anfragen');
    expect(resolveFormMessage('forms.defaults.first_name.placeholder', { messages })).toBe(
      'Dein Vorname'
    );
    expect(
      resolveFormMessage('forms.privacy.consentLabel', { messages, params: { companyName: 'MPU West' } })
    ).toBe('Ja, MPU West darf mich kontaktieren.');
    expect(resolveFormMessage('forms.defaults.last_name.label', { messages })).toBe('Nachname');
    expect(resolveFormMessage('Literal text', { messages })).toBe('Literal text');
  });

  it('switches German validation copy to du and honours messages.validation', () => {
    expect(validationMessage({ code: 'INVALID_EMAIL' }, { formality: 'informal' })).toBe(
      'Bitte gib eine gültige E-Mail-Adresse ein.'
    );
    expect(validationMessage({ code: 'CONSENT_REQUIRED' }, { formality: 'informal' })).toBe(
      'Deine Einwilligung ist erforderlich.'
    );
    expect(validationMessage({ code: 'REQUIRED' }, { language: 'en', formality: 'informal' })).toBe(
      'This field is required.'
    );
    expect(
      validationMessage(
        { code: 'CONSENT_REQUIRED' },
        { messages: { validation: { CONSENT_REQUIRED: 'Bitte stimme den Datenschutzbestimmungen zu.' } } }
      )
    ).toBe('Bitte stimme den Datenschutzbestimmungen zu.');
  });
});
