import { describe, expect, it } from 'vitest';
import {
  isComponentVisibleToVisitors,
  normalizePublicFormDefinition,
  prepareSubmissionData,
  validateComponentValue,
  validateFormValues,
  type PublicFormComponent
} from './index';

function component(
  overrides: Partial<PublicFormComponent> & { type: string }
): PublicFormComponent {
  return { id: 'field-1', required: false, raw: {}, ...overrides };
}

describe('validateComponentValue', () => {
  it('reports missing required values with a structured code', () => {
    expect(validateComponentValue(component({ type: 'text', required: true }), '')).toMatchObject({
      componentId: 'field-1',
      code: 'REQUIRED'
    });
    expect(
      validateComponentValue(component({ type: 'multiple_choice', required: true }), [])
    ).toMatchObject({ code: 'REQUIRED' });
    expect(validateComponentValue(component({ type: 'text', required: true }), 'Ada')).toBeNull();
    expect(validateComponentValue(component({ type: 'text' }), '')).toBeNull();
  });

  it('validates email format like the hosted renderer', () => {
    expect(validateComponentValue(component({ type: 'email' }), 'not-an-email')).toMatchObject({
      code: 'INVALID_EMAIL'
    });
    expect(validateComponentValue(component({ type: 'email' }), 'ada@example.com')).toBeNull();
  });

  it('validates phone numbers with libphonenumber, not a loose pattern', () => {
    expect(validateComponentValue(component({ type: 'phone_number' }), '123')).toMatchObject({
      code: 'INVALID_PHONE_NUMBER'
    });
    expect(validateComponentValue(component({ type: 'phone_number' }), '0170 1234567')).toBeNull();
    expect(
      validateComponentValue(component({ type: 'phone' }), '06 12345678', { defaultCountry: 'NL' })
    ).toBeNull();
  });

  it('reports unchecked consent checkboxes as CONSENT_REQUIRED', () => {
    expect(
      validateComponentValue(component({ type: 'privacy_policy', required: true }), false)
    ).toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(
      validateComponentValue(component({ type: 'privacy_policy', required: true }), true)
    ).toBeNull();
  });

  it('never reports tracking_consent as CONSENT_REQUIRED, even when a definition marks it required', () => {
    const tracking = component({
      type: 'tracking_consent',
      required: true,
      checkboxText: 'Ich bin einverstanden.'
    });
    expect(validateComponentValue(tracking, false)).toBeNull();
    expect(validateComponentValue(tracking, undefined)).toBeNull();
    expect(validateComponentValue(tracking, true)).toBeNull();
  });

  it('skips a hidden tracking_consent checkbox (empty checkboxText) entirely', () => {
    expect(
      validateComponentValue(component({ type: 'tracking_consent', required: true }), false)
    ).toBeNull();
  });

  it('requires the street, postal code, and city of a required address', () => {
    expect(
      validateComponentValue(component({ type: 'address', required: true }), {
        street: 'Hauptstr. 1',
        postal: '',
        city: 'Berlin'
      })
    ).toMatchObject({ code: 'INCOMPLETE_ADDRESS' });
  });

  it('skips presentational components entirely', () => {
    expect(
      validateComponentValue(component({ type: 'heading', required: true }), undefined)
    ).toBeNull();
  });
});

const definition = normalizePublicFormDefinition(
  {
    pages: [
      {
        id: 'page-1',
        components: [
          { id: 'email', type: 'email', isRequired: true },
          { id: 'phone', type: 'phone_number' },
          { id: 'note', type: 'textarea' }
        ]
      },
      { id: 'thanks', type: 'thank_you', content: [] }
    ]
  },
  { formId: 'form-1' }
);

describe('validateFormValues', () => {
  it('collects issues across all regular pages', () => {
    const issues = validateFormValues(definition, { email: 'nope', phone: 'abc' });
    expect(issues.map((entry) => [entry.componentId, entry.code])).toEqual([
      ['email', 'INVALID_EMAIL'],
      ['phone', 'INVALID_PHONE_NUMBER']
    ]);
    expect(
      validateFormValues(definition, { email: 'ada@example.com', phone: '+491701234567' })
    ).toEqual([]);
  });
});

describe('prepareSubmissionData', () => {
  it('normalizes phone fields to E.164, drops empty phones and undefined values', () => {
    expect(
      prepareSubmissionData(definition, {
        email: 'ada@example.com',
        phone: '0170 1234567',
        note: undefined
      })
    ).toEqual({ email: 'ada@example.com', phone: '+491701234567' });

    expect(prepareSubmissionData(definition, { email: 'ada@example.com', phone: '  ' })).toEqual({
      email: 'ada@example.com'
    });
  });

  it('leaves invalid phone values untouched for validation to report', () => {
    expect(prepareSubmissionData(definition, { phone: 'not a phone' })).toEqual({
      phone: 'not a phone'
    });
  });

  it('submits a checked tracking_consent as true and an unchecked one as false', () => {
    const consentDefinition = normalizePublicFormDefinition(
      {
        id: 'form-2',
        version: {
          id: 'version-2',
          version: 1,
          pages: [
            {
              id: 'page-1',
              type: 'regular',
              components: [
                { id: 'email', type: 'email', required: true },
                { id: 'tracking', type: 'tracking_consent', checkboxText: 'Einverstanden.' }
              ]
            }
          ]
        }
      },
      { formId: 'form-2' }
    );
    expect(
      prepareSubmissionData(consentDefinition, { email: 'ada@example.com', tracking: true })
    ).toEqual({ email: 'ada@example.com', tracking: true });
    expect(
      prepareSubmissionData(consentDefinition, { email: 'ada@example.com', tracking: false })
    ).toEqual({ email: 'ada@example.com', tracking: false });
  });

  it('drops values for a hidden tracking_consent checkbox', () => {
    const hiddenDefinition = normalizePublicFormDefinition(
      {
        id: 'form-3',
        version: {
          id: 'version-3',
          version: 1,
          pages: [
            {
              id: 'page-1',
              type: 'regular',
              components: [{ id: 'tracking', type: 'tracking_consent', checkboxText: '' }]
            }
          ]
        }
      },
      { formId: 'form-3' }
    );
    expect(isComponentVisibleToVisitors({ type: 'tracking_consent', checkboxText: '' })).toBe(false);
    expect(prepareSubmissionData(hiddenDefinition, { tracking: true })).toEqual({});
  });
});
