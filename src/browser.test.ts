import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type BrowserForms = Pick<
  typeof import('./index'),
  | 'captureAcquisitionTracking'
  | 'checkPhoneVerification'
  | 'describePhoneInput'
  | 'getPublicForm'
  | 'normalizePhoneNumber'
  | 'phoneVerificationRequired'
  | 'resolveFormMessage'
  | 'sendPhoneVerification'
  | 'submitWithRetry'
  | 'validateFormValues'
>;

const browserBundle = readFileSync(new URL('../dist/browser.js', import.meta.url), 'utf8');

const throwingStorage = {
  getItem() {
    throw new Error('Storage is blocked.');
  },
  setItem() {
    throw new Error('Storage is blocked.');
  },
  removeItem() {
    throw new Error('Storage is blocked.');
  }
};

function loadBrowserForms(): BrowserForms {
  const context = createContext({
    Headers,
    Response,
    URL,
    crypto: {
      getRandomValues(bytes: Uint8Array) {
        bytes.fill(7);
        return bytes;
      }
    },
    sessionStorage: throwingStorage
  });

  runInContext(browserBundle, context, { filename: 'dist/browser.js' });
  const forms = Reflect.get(context, 'MoreflowForms');
  expect(forms).toBeTruthy();
  return forms as BrowserForms;
}

describe('@moreflow/forms browser build', () => {
  it('runs as a classic script with the global API, storage fallback, phone normalization, and auth', async () => {
    expect(browserBundle).not.toMatch(/(?:^|\n)\s*import\s/mu);

    const forms = loadBrowserForms();
    expect(forms.normalizePhoneNumber('+49 (170) 1234567')).toEqual({
      status: 'valid',
      e164: '+491701234567'
    });

    const firstTracking = forms.captureAcquisitionTracking({
      location: { href: 'https://landing.example.test/?utm_source=browser' },
      storage: throwingStorage
    });
    const persistedTracking = forms.captureAcquisitionTracking({
      location: { href: 'https://landing.example.test/contact' },
      storage: throwingStorage
    });
    expect(firstTracking.utm_source).toBe('browser');
    expect(persistedTracking.utm_source).toBe('browser');

    let authorization: string | null = null;
    const result = await forms.submitWithRetry<{ record: { id: string } }>({
      formId: 'browser-form',
      input: { data: { name: 'Ada' } },
      tracking: {},
      storage: throwingStorage,
      baseUrl: 'https://api.example.test',
      token: 'mfo_browser-token',
      fetchImpl: async (_input, init) => {
        authorization = new Headers(init?.headers).get('Authorization');
        return new Response(JSON.stringify({ record: { id: 'browser-submission' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    expect(authorization).toBe('Bearer mfo_browser-token');
    expect(result.data).toEqual({ record: { id: 'browser-submission' } });

    const challenge = await forms.sendPhoneVerification({
      formId: 'browser-form',
      phoneNumber: '0170 1234567',
      baseUrl: 'https://api.example.test',
      fetchImpl: async () =>
        new Response(JSON.stringify({ success: true, challengeId: 'browser-challenge' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
    });
    expect(challenge).toMatchObject({
      challengeId: 'browser-challenge',
      phoneNumber: '+491701234567'
    });

    const verification = await forms.checkPhoneVerification({
      formId: 'browser-form',
      phoneNumber: '+491701234567',
      code: '123456',
      challengeId: 'browser-challenge',
      baseUrl: 'https://api.example.test',
      fetchImpl: async () =>
        new Response(JSON.stringify({ success: true, verified: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
    });
    expect(verification).toEqual({ verified: true, phoneNumber: '+491701234567' });

    const definition = await forms.getPublicForm({
      formId: 'browser-form',
      baseUrl: 'https://api.example.test',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            record: { id: 'browser-form', data: { name: 'Browser form' } },
            version: {
              formId: 'browser-form',
              settings: {},
              pages: [
                {
                  id: 'page-1',
                  components: [
                    {
                      id: 'phone',
                      type: 'phone_number',
                      label: 'forms.defaults.phone_number.label',
                      isRequired: true,
                      verifyPhone: true
                    }
                  ]
                }
              ]
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    });
    expect(forms.phoneVerificationRequired(definition)).toBe(true);
    expect(forms.validateFormValues(definition, { phone: '123' })).toMatchObject([
      { componentId: 'phone', code: 'INVALID_PHONE_NUMBER' }
    ]);
    expect(forms.resolveFormMessage('forms.defaults.phone_number.label')).toBe('Telefonnummer');
    expect(forms.describePhoneInput('+49 170 1234567')).toMatchObject({
      country: 'DE',
      nationalNumber: '1701234567'
    });
  });
});
