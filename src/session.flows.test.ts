// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, normalizePublicFormDefinition, type PublicFormDefinition } from './index';
import { createFormSession, type FormSessionOptions, toFormSessionError } from './session';
import type { TurnstileMountOptions } from './turnstile';

const turnstile = vi.hoisted(() => ({ mount: vi.fn() }));
vi.mock('./turnstile', () => ({ mountTurnstile: turnstile.mount }));

afterEach(() => {
  turnstile.mount.mockReset();
});

function definitionWith(
  overrides: Record<string, unknown> = {},
  contact: unknown[] = [{ id: 'phone', type: 'phone_number', required: true, verifyPhone: true }],
  settings: Record<string, unknown> = {}
) {
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
      settings: { submitButtonText: 'forms.settings.submitButton', thankYouPageUrl: '', ...settings },
      pages: [
        { id: 'step-topic', type: 'regular', components: [{ id: 'topic', type: 'dropdown', required: true, options: ['MPU'] }] },
        { id: 'step-contact', type: 'regular', components: contact }
      ],
      fieldMatching: []
    },
    ...overrides
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function api(routes: Record<string, () => Response | Promise<Response>>) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    calls.push(key);
    const route = Object.keys(routes).find((candidate) => key.endsWith(candidate));
    if (!route) throw new Error(`Unexpected request ${key}`);
    const handler = routes[route];
    if (!handler) throw new Error(`Unexpected request ${key}`);
    return handler();
  });
  return { calls, fetchImpl };
}

function session(definition: PublicFormDefinition, options: FormSessionOptions = {}) {
  return createFormSession(definition, { baseUrl: '', storage: createMemoryStorage(), ...options });
}

const sendOk = () => json({ challengeId: 'challenge-1' });
const verifyOk = () => json({ verified: true });

describe('form session phone verification', () => {
  it('flags an empty or invalid number on sendCode without calling the API', async () => {
    const { calls, fetchImpl } = api({});
    const form = session(definitionWith(), { fetchImpl });

    expect(await form.phoneVerification.sendCode()).toBe(false);
    expect(form.getSnapshot()).toMatchObject({ stepIndex: 1, focusComponentId: 'phone', issues: { phone: { code: 'REQUIRED' } } });

    form.setValue('phone', '12');
    expect(await form.phoneVerification.sendCode()).toBe(false);
    expect(form.getSnapshot().issues.phone?.code).toBe('INVALID_PHONE_NUMBER');
    expect(calls).toEqual([]);
  });

  it('does nothing without a verification component or challenge', async () => {
    const form = session(definitionWith({}, [{ id: 'email', type: 'email' }]));

    expect(form.getSnapshot().phoneVerification).toBeNull();
    expect(await form.phoneVerification.sendCode()).toBe(false);
    expect(await form.phoneVerification.verify('123456')).toBe(false);
    form.phoneVerification.changeNumber();
    form.phoneVerification.setCode('1');
    expect(form.getSnapshot().phoneVerification).toBeNull();
  });

  it('verifies outside a submit without submitting, and resets when the verified number changes', async () => {
    const { calls, fetchImpl } = api({
      'PUT /v1/forms/form-1/phone-verification': sendOk,
      'POST /v1/forms/form-1/phone-verification': verifyOk
    });
    const form = session(definitionWith(), { fetchImpl });
    form.setValue('phone', '0170 1234567');

    expect(await form.phoneVerification.sendCode()).toBe(true);
    expect(form.getSnapshot().phoneVerification).toMatchObject({ status: 'code_sent', phoneNumber: '+491701234567' });
    expect(await form.phoneVerification.verify('123456')).toBe(true);
    expect(form.getSnapshot()).toMatchObject({ status: 'editing', phoneVerification: { status: 'verified' } });
    expect(calls).toHaveLength(2);

    form.setValue('phone', '+49 170 1234567');
    expect(form.getSnapshot().phoneVerification?.status).toBe('verified');

    form.setValue('phone', '0170 7654321');
    expect(form.getSnapshot().phoneVerification).toMatchObject({ status: 'idle', phoneNumber: undefined });
  });

  it('keeps the code panel open when a resend fails', async () => {
    let sends = 0;
    const { fetchImpl } = api({
      'PUT /v1/forms/form-1/phone-verification': () => {
        sends += 1;
        return sends === 1 ? sendOk() : json({ error: { code: 'RATE_LIMIT', message: 'Slow down.' } }, 429);
      }
    });
    const form = session(definitionWith(), { fetchImpl, language: 'en' });
    form.setValue('phone', '0170 1234567');

    expect(await form.phoneVerification.sendCode()).toBe(true);
    expect(await form.phoneVerification.resend()).toBe(false);
    expect(form.getSnapshot().phoneVerification).toMatchObject({ status: 'code_sent', error: { code: 'RATE_LIMIT' } });
  });

  it('goes back from verifying to editing the number', async () => {
    const { fetchImpl } = api({ 'PUT /v1/forms/form-1/phone-verification': sendOk });
    const form = session(definitionWith(), { fetchImpl });
    form.setValue('topic', 'MPU');
    form.setValue('phone', '0170 1234567');

    expect(await form.submit()).toBe(false);
    expect(form.getSnapshot().status).toBe('verifying');
    expect(await form.next()).toBe(false);
    expect(await form.submit()).toBe(false);

    expect(form.back()).toBe(true);
    expect(form.getSnapshot()).toMatchObject({ status: 'editing', stepIndex: 1, phoneVerification: { status: 'idle', code: '' } });
    // The challenge is gone after changing the number.
    expect(await form.phoneVerification.verify('123456')).toBe(false);
  });

});

describe('form session submission edges', () => {
  const contact = [{ id: 'email', type: 'email', required: true }];

  it('drops a non-http thank-you redirect', async () => {
    const { fetchImpl } = api({ 'POST /v1/forms/form-1/submissions': () => json({ id: 'submission-1' }) });
    const form = session(definitionWith({}, contact, { thankYouPageUrl: 'javascript:alert(1)' }), { fetchImpl });
    form.setValue('topic', 'MPU');
    form.setValue('email', 'erika@example.test');

    expect(await form.submit()).toBe(true);
    expect(form.getSnapshot().result?.redirectUrl).toBeUndefined();
  });

  it('drops a malformed thank-you redirect', async () => {
    const { fetchImpl } = api({ 'POST /v1/forms/form-1/submissions': () => json({ id: 'submission-1' }) });
    const form = session(definitionWith({}, contact, { thankYouPageUrl: 'http://[broken' }), { fetchImpl });
    form.setValue('topic', 'MPU');
    form.setValue('email', 'erika@example.test');

    expect(await form.submit()).toBe(true);
    expect(form.getSnapshot()).toMatchObject({ status: 'submitted', progress: 1, result: { redirectUrl: undefined } });
  });

  it('ignores server-named fields the form does not have', async () => {
    const { fetchImpl } = api({
      'POST /v1/forms/form-1/submissions': () =>
        json({ error: { code: 'VALIDATION_ERROR', message: 'Missing.', details: { missingFieldIds: ['ghost'] } } }, 400)
    });
    const form = session(definitionWith({}, contact), { fetchImpl });
    form.setValue('topic', 'MPU');
    form.setValue('email', 'erika@example.test');

    expect(await form.submit()).toBe(false);
    expect(form.getSnapshot()).toMatchObject({ status: 'editing', issues: {}, error: { code: 'VALIDATION_ERROR' } });
  });

  it('describes unknown failures as retryable-false REQUEST_FAILED', () => {
    expect(toFormSessionError('boom', { language: 'en' })).toMatchObject({ code: 'REQUEST_FAILED', retryable: false, cause: 'boom' });
    expect(toFormSessionError({ code: 'X', retryable: true }, { language: 'en' })).toMatchObject({ code: 'X', retryable: true });
  });
});

describe('form session Turnstile', () => {
  const enabled = { spamProtection: { turnstile: { siteKey: 'site-key', mode: 'require' } } };
  const contact = [{ id: 'email', type: 'email' }];

  it('is a no-op while Turnstile is off', async () => {
    const form = session(definitionWith({}, contact));
    const unmount = await form.turnstile.mount(document.createElement('div'));
    form.turnstile.setToken('token');
    form.turnstile.fail();

    unmount();
    expect(turnstile.mount).not.toHaveBeenCalled();
    expect(form.getSnapshot().turnstile).toMatchObject({ enabled: false, status: 'disabled', token: null });
  });

  it('tracks token, expiry and error callbacks and destroys the widget on unmount', async () => {
    const widget = { reset: vi.fn(), destroy: vi.fn() };
    let callbacks: TurnstileMountOptions | undefined;
    turnstile.mount.mockImplementation(async (_container: HTMLElement, mountOptions: TurnstileMountOptions) => {
      callbacks = mountOptions;
      return widget;
    });
    const form = session(definitionWith(enabled, contact));
    const container = document.createElement('div');

    const unmount = await form.turnstile.mount(container);

    expect(turnstile.mount).toHaveBeenCalledWith(container, expect.objectContaining({ siteKey: 'site-key' }));
    callbacks?.onToken?.('token-1');
    expect(form.getSnapshot().turnstile).toMatchObject({ token: 'token-1', status: 'ready' });
    callbacks?.onExpired?.();
    expect(form.getSnapshot().turnstile).toMatchObject({ token: null, status: 'loading' });
    callbacks?.onError?.();
    expect(form.getSnapshot().turnstile).toMatchObject({ token: null, status: 'error' });

    form.turnstile.setToken(null);
    expect(form.getSnapshot().turnstile.status).toBe('loading');
    form.turnstile.fail();
    expect(form.getSnapshot().turnstile.status).toBe('error');

    form.reset();
    expect(widget.reset).toHaveBeenCalledOnce();
    unmount();
    expect(widget.destroy).toHaveBeenCalledOnce();
    form.dispose();
    expect(widget.destroy).toHaveBeenCalledOnce();
  });

  it('reports a failed mount as a Turnstile and form error', async () => {
    turnstile.mount.mockRejectedValue({ code: 'TURNSTILE_UNAVAILABLE', retryable: true });
    const form = session(definitionWith(enabled, contact), { language: 'en' });

    const unmount = await form.turnstile.mount(document.createElement('div'));

    expect(unmount()).toBeUndefined();
    expect(form.getSnapshot()).toMatchObject({
      turnstile: { status: 'error' },
      error: { code: 'TURNSTILE_UNAVAILABLE', retryable: true }
    });
  });
});
