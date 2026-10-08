import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  formErrorMessage,
  formInputComponents,
  getPublicForm,
  MoreflowFormError,
  normalizePublicFormDefinition,
  type PublicFormAccountId,
  type PublicFormDefinition,
  partitionFormPages,
  phoneVerificationRequired
} from './index';

const richThankYou = {
  id: 'page-thanks',
  type: 'thank_you',
  content: [
    { id: 'ty-heading', type: 'heading', props: { content: 'Vielen Dank!' } },
    { id: 'ty-text', type: 'text', props: { content: 'Wir melden uns.' } }
  ]
};

const regularPage = {
  id: 'page-1',
  type: 'regular',
  title: 'Kontakt',
  components: [
    {
      id: 'first-name',
      type: 'first_name',
      label: 'forms.defaults.first_name.label',
      isRequired: true
    },
    {
      id: 'phone',
      type: 'phone_number',
      label: 'forms.defaults.phone_number.label',
      required: true,
      verifyPhone: true,
      customProp: 'kept'
    },
    {
      id: 'topic',
      type: 'dropdown',
      options: ['Sales', { id: 'opt-2', value: 'support', label: 'Support' }]
    }
  ]
};

const canonicalBody = {
  honeypotField: 'website',
  spamProtection: { turnstile: { siteKey: 'sitekey_1', mode: 'flag' } },
  record: {
    id: 'form-1',
    accountId: 'account-1',
    data: {
      name: 'Kontaktformular',
      config: {
        current_version: {
          id: 'version-1',
          formId: 'form-1',
          version: 4,
          settings: { submitButtonText: 'forms.settings.submitButton' },
          pages: [regularPage, richThankYou],
          field_matching: [{ formFieldId: 'first-name', clientField: 'firstName' }]
        }
      }
    }
  },
  version: {
    id: 'version-1',
    formId: 'form-1',
    version: 4,
    settings: { submitButtonText: 'forms.settings.submitButton' },
    pages: [regularPage, richThankYou],
    fieldMatching: [{ formFieldId: 'first-name', clientField: 'firstName' }]
  },
  trace: { requestId: 'req-1' }
};

describe('normalizePublicFormDefinition', () => {
  it('exposes an account-specific brand while remaining usable as a string', () => {
    expectTypeOf<PublicFormDefinition['accountId']>().toEqualTypeOf<
      PublicFormAccountId | undefined
    >();
    expectTypeOf<PublicFormAccountId>().toExtend<string>();
    expectTypeOf<string>().not.toExtend<PublicFormAccountId>();
    expectTypeOf<string & { readonly __tableName: 'clients' }>().not.toExtend<PublicFormAccountId>();
  });

  it('normalizes the canonical {record, version} response into one shape', () => {
    const definition = normalizePublicFormDefinition(canonicalBody);

    expect(definition.formId).toBe('form-1');
    expect(definition.accountId).toBe('account-1');
    expect(definition.name).toBe('Kontaktformular');
    expect(definition.honeypotField).toBe('website');
    expect(definition.spamProtection).toEqual({
      turnstile: { siteKey: 'sitekey_1', mode: 'flag' }
    });
    expect(definition.versionNumber).toBe(4);
    expect(definition.fieldMatching).toEqual([
      { formFieldId: 'first-name', clientField: 'firstName' }
    ]);

    const { steps, thankYou } = partitionFormPages(definition);
    expect(steps).toHaveLength(1);
    expect(thankYou?.content.map((item) => item.type)).toEqual(['heading', 'text']);
    expect(thankYou?.content[0]?.props).toEqual({ content: 'Vielen Dank!' });
  });

  it('brands the selected payload account ID before the record fallback', () => {
    const definition = normalizePublicFormDefinition({
      ...canonicalBody,
      version: { ...canonicalBody.version, accountId: 'selected-account' }
    });

    expect(definition.accountId).toBe('selected-account');
  });

  it.each([undefined, null, '', '   ', 42])(
    'keeps an absent or invalid account ID optional (%s)',
    (accountId) => {
      const definition = normalizePublicFormDefinition({
        formId: 'form-1',
        pages: [regularPage],
        accountId
      });

      expect(definition.accountId).toBeUndefined();
    }
  );

  it('falls back to the record account ID when the selected payload ID is invalid', () => {
    const definition = normalizePublicFormDefinition({
      ...canonicalBody,
      version: { ...canonicalBody.version, accountId: 42 }
    });

    expect(definition.accountId).toBe('account-1');
  });

  it('merges the required/isRequired duality and keeps passthrough props in raw', () => {
    const definition = normalizePublicFormDefinition(canonicalBody);
    const [firstName, phone, topic] = formInputComponents(definition);

    expect(firstName).toMatchObject({ id: 'first-name', required: true });
    expect(phone).toMatchObject({ id: 'phone', required: true, verifyPhone: true });
    expect(phone?.raw.customProp).toBe('kept');
    expect(topic?.required).toBe(false);
    expect(topic?.options).toEqual([
      { value: 'Sales', label: 'Sales' },
      { id: 'opt-2', value: 'support', label: 'Support' }
    ]);
  });

  it('prefers the candidate whose thank-you page still has content props', () => {
    const strippedThankYou = {
      ...richThankYou,
      content: richThankYou.content.map(({ id, type }) => ({ id, type }))
    };
    const body = {
      ...canonicalBody,
      version: { ...canonicalBody.version, pages: [regularPage, strippedThankYou] }
    };

    const definition = normalizePublicFormDefinition(body);
    expect(partitionFormPages(definition).thankYou?.content[0]?.props).toEqual({
      content: 'Vielen Dank!'
    });
  });

  it('reads snake_case field_matching and falls back through candidate shapes', () => {
    const definition = normalizePublicFormDefinition({
      record: {
        id: 'form-2',
        data: {
          config: {
            current_version: {
              pages: [regularPage],
              field_matching: [{ formFieldId: 'phone', clientField: 'phone' }]
            }
          }
        }
      }
    });

    expect(definition.formId).toBe('form-2');
    expect(definition.fieldMatching).toEqual([{ formFieldId: 'phone', clientField: 'phone' }]);
  });

  it('renders legacy string thank-you content as a text item', () => {
    const definition = normalizePublicFormDefinition(
      { pages: [{ id: 'thanks', type: 'thank_you', content: 'Danke!' }] },
      { formId: 'form-3' }
    );

    expect(partitionFormPages(definition).thankYou?.content).toEqual([
      {
        id: 'thanks:content',
        type: 'text',
        props: { content: 'Danke!' },
        raw: { content: 'Danke!' }
      }
    ]);
  });

  it('throws a navigational error when no candidate contains pages', () => {
    expect(() => normalizePublicFormDefinition({ record: { id: 'form-1' } })).toThrowError(
      expect.objectContaining({ name: 'MoreflowFormError', code: 'INVALID_FORM_DEFINITION' })
    );
  });

  it('detects phone verification requirements for custom embeds', () => {
    expect(phoneVerificationRequired(normalizePublicFormDefinition(canonicalBody))).toBe(true);

    const withoutVerification = normalizePublicFormDefinition(
      {
        pages: [
          {
            id: 'page-1',
            components: [{ id: 'phone', type: 'phone_number', required: true }]
          }
        ]
      },
      { formId: 'form-4' }
    );
    expect(phoneVerificationRequired(withoutVerification)).toBe(false);
  });
});

describe('getPublicForm', () => {
  it('loads and normalizes the published form over HTTP', async () => {
    const fetchImpl = vi.fn(async () => Response.json(canonicalBody));

    const definition = await getPublicForm({
      formId: 'form-1',
      baseUrl: 'https://api.example.test/',
      token: 'mfo_token',
      fetchImpl
    });

    expect(definition.formId).toBe('form-1');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/v1/forms/form-1');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer mfo_token');
  });

  it('surfaces the server code and message for an unpublished form', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { code: 'FORM_UNPUBLISHED', message: 'This public form is not published.' },
        { status: 409 }
      )
    );

    const error = await getPublicForm({ formId: 'form-1', fetchImpl }).catch(
      (caught: unknown) => caught
    );
    expect(error).toMatchObject({
      name: 'MoreflowFormError',
      code: 'FORM_UNPUBLISHED',
      status: 409,
      retryable: false,
      message: 'This public form is not published.'
    });
    expect(formErrorMessage(error)).toBe('This public form is not published.');
  });

  it('extracts nested operation-failure messages too', () => {
    const error = new MoreflowFormError({
      message: 'Moreflow form submission failed with HTTP 400.',
      responseBody: { error: { code: 'CLIENT_NO_EMAIL', message: 'Client has no email address.' } }
    });
    expect(formErrorMessage(error)).toBe('Client has no email address.');
    expect(formErrorMessage(new Error('boom'))).toBe('boom');
    expect(formErrorMessage('nope', 'Fallback message.')).toBe('Fallback message.');
  });

  it('wraps network failures as retryable errors', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });

    await expect(getPublicForm({ formId: 'form-1', fetchImpl })).rejects.toMatchObject({
      name: 'MoreflowFormError',
      retryable: true
    });
  });
});
