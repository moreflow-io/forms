import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, normalizePublicFormDefinition, type PublicFormDefinition } from './index';
import { createFormSession, type FormSessionOptions } from './session';

function definitionWith(overrides: Record<string, unknown> = {}, components?: unknown[]) {
  return normalizePublicFormDefinition({
    id: 'form-1',
    accountId: 'account-1',
    honeypotField: 'website',
    spamProtection: { turnstile: { siteKey: '', mode: 'off' } },
    companyName: 'MPU West',
    language: 'de',
    version: {
      id: 'version-1',
      formId: 'form-1',
      settings: { submitButtonText: 'forms.settings.submitButton', thankYouPageUrl: '' },
      pages: [
        {
          id: 'step-topic',
          type: 'regular',
          components: [
            {
              id: 'topic',
              type: 'dropdown',
              required: true,
              options: ['MPU', 'Führerschein']
            }
          ]
        },
        {
          id: 'step-contact',
          type: 'regular',
          components: components ?? [
            { id: 'name', type: 'first_name', label: 'forms.defaults.first_name.label', required: true },
            { id: 'email', type: 'email', required: true },
            { id: 'privacy', type: 'privacy_policy', required: true },
            { id: 'tracking', type: 'tracking_consent', checkboxText: 'Ich erlaube Tracking.' },
            { id: 'marketing', type: 'marketing_consent' }
          ]
        },
        {
          id: 'thanks',
          type: 'thank_you',
          content: [{ id: 'ty', type: 'heading', props: { content: 'Danke!' } }]
        }
      ],
      fieldMatching: [{ formFieldId: 'email', clientField: 'email' }]
    },
    ...overrides
  });
}

type Call = { url: string; method: string; body: Record<string, unknown> };

function api(responses: Record<string, (body: Record<string, unknown>) => Response>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ url, method, body });
    const route = Object.keys(responses).find((key) => `${method} ${url}`.endsWith(key));
    if (!route) throw new Error(`Unexpected request ${method} ${url}`);
    return (responses[route] as (body: Record<string, unknown>) => Response)(body);
  });
  return { calls, fetchImpl };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function session(definition: PublicFormDefinition, options: FormSessionOptions = {}) {
  return createFormSession(definition, { baseUrl: '', storage: createMemoryStorage(), ...options });
}

async function fillToSubmit(form: ReturnType<typeof session>) {
  form.setValue('topic', 'MPU');
  await form.next();
  form.setValue('name', 'Erika');
  form.setValue('email', 'erika@example.test');
  form.setValue('privacy', true);
}

describe('createFormSession', () => {
  it('defaults language and company name from the definition and resolves labels', () => {
    const form = session(definitionWith());
    const state = form.getSnapshot();

    expect(state).toMatchObject({
      language: 'de',
      companyName: 'MPU West',
      stepIndex: 0,
      isFirstStep: true,
      isLastStep: false,
      status: 'editing',
      progress: 0,
      labels: { submit: 'Absenden', continue: 'Weiter' },
      honeypot: { name: 'website', value: '' },
      turnstile: { enabled: false, status: 'disabled' },
      phoneVerification: null
    });
    expect(state.steps).toHaveLength(2);
    // The marketing box is shown because the server named the company.
    expect(state.steps[1]?.components.map((component) => component.id)).toContain('marketing');
    expect(form.message('forms.defaults.first_name.label')).toBe('Vorname');
    expect(form.marketingConsentText()).toContain('MPU West');
  });

  it('validates the current step with localized du copy and focuses the first issue', async () => {
    const form = session(definitionWith(), {
      formality: 'informal',
      messages: { validation: { REQUIRED: 'Bitte wähle etwas aus.' } }
    });
    const listener = vi.fn();
    form.subscribe(listener);

    expect(await form.next()).toBe(false);
    expect(form.getSnapshot().issues.topic?.message).toBe('Bitte wähle etwas aus.');
    expect(form.getSnapshot().focusComponentId).toBe('topic');

    form.setValue('topic', 'MPU');
    expect(form.getSnapshot().issues.topic).toBeUndefined();
    expect(await form.next()).toBe(true);
    expect(form.getSnapshot()).toMatchObject({ stepIndex: 1, isLastStep: true, progress: 0.5 });
    expect(listener).toHaveBeenCalled();

    form.setValue('email', 'not-an-email');
    form.blur('email');
    expect(form.getSnapshot().issues.email?.message).toBe(
      'Bitte gib eine gültige E-Mail-Adresse ein.'
    );
    form.blur('name');
    expect(form.getSnapshot().issues.name).toBeUndefined();

    expect(form.back()).toBe(true);
    expect(form.getSnapshot().stepIndex).toBe(0);
    expect(form.back()).toBe(false);
  });

  it('submits locale, honeypot, field matching and an explicit decline for untouched optional boxes', async () => {
    const { calls, fetchImpl } = api({
      'POST /v1/forms/form-1/submissions': () => json({ id: 'submission-1' })
    });
    const form = session(definitionWith(), {
      fetchImpl,
      acquisitionTracking: true,
      trackingCapture: () => ({ utm_source: 'google' })
    });
    await fillToSubmit(form);
    form.setHoneypot('');

    expect(await form.next()).toBe(true);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toMatchObject({
      data: {
        topic: 'MPU',
        name: 'Erika',
        email: 'erika@example.test',
        privacy: true,
        tracking: false,
        marketing: false
      },
      fieldMatching: [{ formFieldId: 'email', clientField: 'email' }],
      locale: 'de',
      spam: { honeypot: '' },
      tracking: { utm_source: 'google' }
    });
    expect(form.getSnapshot()).toMatchObject({
      status: 'submitted',
      progress: 1,
      result: {
        submission: { id: 'submission-1' },
        redirectUrl: undefined,
        thankYou: { id: 'thanks', type: 'thank_you' }
      }
    });
  });

  it('drops the marketing box without a company name and follows a thank-you redirect URL', async () => {
    const { calls, fetchImpl } = api({
      'POST /v1/forms/form-1/submissions': () => json({ id: 'submission-1' })
    });
    const definition = definitionWith({ companyName: undefined });
    definition.settings.thankYouPageUrl = 'https://mpu-west.test/danke';
    const form = session(definition, { fetchImpl, language: 'en' });
    expect(form.getSnapshot().steps[1]?.components.map((component) => component.id)).not.toContain(
      'marketing'
    );
    await fillToSubmit(form);
    form.setValue('marketing', true);

    await form.submit();

    expect(calls[0]?.body.locale).toBe('en');
    expect(calls[0]?.body.data).not.toHaveProperty('marketing');
    expect(form.getSnapshot().result?.redirectUrl).toBe('https://mpu-west.test/danke');
  });

  it('jumps to the first invalid step on submit', async () => {
    const form = session(definitionWith());
    form.setValue('topic', 'MPU');
    await form.next();

    expect(await form.submit()).toBe(false);
    expect(form.getSnapshot()).toMatchObject({ stepIndex: 1, focusComponentId: 'name' });
    expect(form.getSnapshot().issues.privacy?.message).toBe('Ihre Einwilligung ist erforderlich.');

    form.setValue('topic', undefined);
    expect(await form.submit()).toBe(false);
    expect(form.getSnapshot()).toMatchObject({ stepIndex: 0, focusComponentId: 'topic' });
  });

  it('waits for a Turnstile token in require mode and resets it after ANTI_SPAM_INVALID', async () => {
    const { calls, fetchImpl } = api({
      'POST /v1/forms/form-1/submissions': () =>
        json({ error: { code: 'ANTI_SPAM_INVALID', message: 'Turnstile rejected the token.' } }, 400)
    });
    const form = session(
      definitionWith({ spamProtection: { turnstile: { siteKey: 'site-key', mode: 'require' } } }),
      { fetchImpl }
    );
    expect(form.getSnapshot().turnstile).toMatchObject({ enabled: true, status: 'loading' });
    await fillToSubmit(form);

    expect(await form.submit()).toBe(false);
    expect(calls).toHaveLength(0);
    expect(form.getSnapshot().error).toMatchObject({
      code: 'ANTI_SPAM_REQUIRED',
      message: 'Bitte warten Sie, bis der Spamschutz geladen ist, und senden Sie das Formular erneut.'
    });

    form.turnstile.setToken('token-1');
    expect(await form.submit()).toBe(false);
    expect(calls[0]?.body.spam).toEqual({ honeypot: '', turnstileToken: 'token-1' });
    expect(form.getSnapshot()).toMatchObject({
      status: 'editing',
      turnstile: { token: null, status: 'loading' },
      error: {
        code: 'ANTI_SPAM_INVALID',
        message: 'Der Spamschutz konnte Ihre Anfrage nicht bestätigen. Bitte versuchen Sie es erneut.'
      }
    });
  });

  it('maps a server VALIDATION_ERROR onto the named fields', async () => {
    const { fetchImpl } = api({
      'POST /v1/forms/form-1/submissions': () =>
        json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Required fields are missing.',
              details: { missingFieldIds: ['topic'] }
            }
          },
          400
        )
    });
    const form = session(definitionWith(), { fetchImpl });
    await fillToSubmit(form);

    expect(await form.submit()).toBe(false);
    expect(form.getSnapshot()).toMatchObject({
      stepIndex: 0,
      focusComponentId: 'topic',
      issues: { topic: { code: 'REQUIRED', message: 'Dieses Feld ist erforderlich.' } },
      error: { code: 'VALIDATION_ERROR', message: 'Bitte füllen Sie alle Pflichtfelder aus.' }
    });
  });

  it('runs phone verification before submitting and submits the verified number', async () => {
    let checks = 0;
    const { calls, fetchImpl } = api({
      'PUT /v1/forms/form-1/phone-verification': () => json({ challengeId: 'challenge-1' }),
      'POST /v1/forms/form-1/phone-verification': () => {
        checks += 1;
        return checks === 1
          ? json({ error: { code: 'INVALID_VERIFICATION_CODE', message: 'Wrong code.' } }, 400)
          : json({ verified: true });
      },
      'POST /v1/forms/form-1/submissions': () => json({ id: 'submission-1' })
    });
    const form = session(
      definitionWith({}, [
        { id: 'phone', type: 'phone_number', required: true, verifyPhone: true }
      ]),
      { fetchImpl, formality: 'informal' }
    );
    form.setValue('topic', 'MPU');
    await form.next();
    form.setValue('phone', '0170 1234567');

    expect(await form.submit()).toBe(false);
    expect(form.getSnapshot()).toMatchObject({
      status: 'verifying',
      phoneVerification: { componentId: 'phone', status: 'code_sent', phoneNumber: '+491701234567' }
    });

    form.phoneVerification.setCode('000000');
    expect(await form.phoneVerification.verify()).toBe(false);
    expect(form.getSnapshot().phoneVerification?.error?.message).toBe(
      'Der Code ist ungültig. Bitte überprüfe deine Eingabe.'
    );

    expect(await form.phoneVerification.verify('123456')).toBe(true);
    expect(form.getSnapshot()).toMatchObject({
      status: 'submitted',
      phoneVerification: { status: 'verified', phoneNumber: '+491701234567' }
    });
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'PUT /v1/forms/form-1/phone-verification',
      'POST /v1/forms/form-1/phone-verification',
      'POST /v1/forms/form-1/phone-verification',
      'POST /v1/forms/form-1/submissions'
    ]);
    expect(calls[2]?.body).toMatchObject({ challengeId: 'challenge-1', code: '123456' });
    expect(calls[3]?.body.data).toMatchObject({ phone: '+491701234567' });
  });

  it('returns to the phone step on changeNumber and reports a failed first send as a form error', async () => {
    const { fetchImpl } = api({
      'PUT /v1/forms/form-1/phone-verification': () =>
        json({ error: { code: 'RATE_LIMIT', message: 'Slow down.' } }, 429)
    });
    const form = session(
      definitionWith({}, [{ id: 'phone', type: 'phone_number', required: true, verifyPhone: true }]),
      { fetchImpl, language: 'en' }
    );
    form.setValue('topic', 'MPU');
    form.setValue('phone', '+49 170 1234567');

    expect(await form.submit()).toBe(false);
    expect(form.getSnapshot()).toMatchObject({
      status: 'editing',
      error: { code: 'RATE_LIMIT', message: 'Too many attempts. Please wait a moment and try again.' },
      phoneVerification: { status: 'idle' }
    });

    form.phoneVerification.changeNumber();
    expect(form.getSnapshot()).toMatchObject({ stepIndex: 1, focusComponentId: 'phone' });
  });

  it('reset returns to a fresh first step', async () => {
    const { fetchImpl } = api({
      'POST /v1/forms/form-1/submissions': () => json({ id: 'submission-1' })
    });
    const form = session(definitionWith(), { fetchImpl, initialValues: { topic: 'MPU' } });
    await form.next();
    form.setValue('name', 'Erika');
    form.setValue('email', 'erika@example.test');
    form.setValue('privacy', true);
    await form.submit();
    expect(form.getSnapshot().status).toBe('submitted');

    form.reset();
    expect(form.getSnapshot()).toMatchObject({
      status: 'editing',
      stepIndex: 0,
      values: { topic: 'MPU' },
      result: null
    });
  });
});
