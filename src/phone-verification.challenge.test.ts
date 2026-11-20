// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { checkPhoneVerification, sendPhoneVerification } from './phone-verification';

const policyId = 'PUT /v1/forms/$formId/phone-verification';
let session = 0;
function setup() {
  const baseUrl = `https://api.moreflow.test/session-${++session}`;
  let enforcing = true;
  let expiry = false;
  const used = new Set<string>();
  const sends: Array<string | null> = [];
  const configRequests: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/v1/security/operation-challenge')) {
      configRequests.push(url);
      return Response.json({
        enabled: true,
        siteKey: 'runtime-site-key',
        actions: { [policyId]: 'form_phone_verification' }
      });
    }
    const token = new Headers(init?.headers).get('x-captcha-response');
    sends.push(token);
    if (init?.method === 'POST') return Response.json({ verified: true });
    if (enforcing && (!token || used.has(token) || expiry)) {
      const code = token ? 'TURNSTILE_TOKEN_INVALID' : 'TURNSTILE_TOKEN_REQUIRED';
      expiry = false;
      return Response.json({ error: { code, message: 'Solve again.' } }, { status: 403 });
    }
    if (token) used.add(token);
    return Response.json({ challengeId: `sms-${sends.length}` });
  });
  let proof = 0;
  const getChallengeToken = vi.fn(
    async (_input: { operationId: string; action: string; signal?: AbortSignal | undefined }) =>
      `fresh-${++proof}`
  );
  const options = {
    baseUrl,
    formId: 'form-1',
    phoneNumber: '+491701234567',
    fetchImpl,
    getChallengeToken
  };
  return {
    options,
    fetchImpl,
    sends,
    configRequests,
    getChallengeToken,
    disable: () => {
      enforcing = false;
    },
    expire: () => {
      expiry = true;
    }
  };
}

describe('form phone send challenge', () => {
  it('makes zero extra requests and loads no proof provider while enforcement is off', async () => {
    const test = setup();
    test.disable();
    await sendPhoneVerification(test.options);
    await sendPhoneVerification(test.options);
    expect(test.fetchImpl).toHaveBeenCalledTimes(2);
    expect(test.configRequests).toHaveLength(0);
    expect(test.getChallengeToken).not.toHaveBeenCalled();
    expect(test.sends).toEqual([null, null]);
  });

  it('learns enforcement once per page and obtains action-bound proof for every later send', async () => {
    const test = setup();
    await sendPhoneVerification(test.options);
    await sendPhoneVerification(test.options);
    await sendPhoneVerification({ ...test.options, formId: 'another-form' });
    expect(test.configRequests).toHaveLength(1);
    expect(test.sends).toEqual([null, 'fresh-1', 'fresh-2', 'fresh-3']);
    expect(test.getChallengeToken).toHaveBeenCalledTimes(3);
    for (const [input] of test.getChallengeToken.mock.calls) {
      expect(input).toMatchObject({
        operationId: policyId,
        action: 'form_phone_verification'
      });
    }
  });

  it('solves again after expiry and never reuses a token or caller header', async () => {
    const test = setup();
    await sendPhoneVerification({
      ...test.options,
      headers: { 'x-captcha-response': 'stale-proof' }
    });
    test.expire();
    await sendPhoneVerification(test.options);
    expect(test.sends).toEqual([null, 'fresh-1', 'fresh-2', 'fresh-3']);
    expect(test.configRequests).toHaveLength(1);
  });

  it('keeps OTP checks token-free and separate from the form submission widget', async () => {
    const test = setup();
    await sendPhoneVerification(test.options);
    await checkPhoneVerification({
      ...test.options,
      challengeId: 'sms-1',
      code: '123456'
    });
    expect(test.sends).toEqual([null, 'fresh-1', null]);
    expect(test.getChallengeToken).toHaveBeenCalledOnce();
    expect(test.fetchImpl.mock.calls.at(-1)?.[1]?.method).toBe('POST');
  });

  it('never retries an ambiguous network failure that might already have sent SMS', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('connection lost'));
    await expect(
      sendPhoneVerification({
        formId: 'form-1',
        phoneNumber: '+491701234567',
        fetchImpl
      })
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('bounds repeated invalid proof to one fresh-proof retry', async () => {
    const test = setup();
    test.getChallengeToken.mockResolvedValue('rejected');
    test.fetchImpl.mockImplementation(async (input, init) =>
      String(input).endsWith('/v1/security/operation-challenge')
        ? Response.json({
            enabled: true,
            siteKey: 'key',
            actions: { [policyId]: 'form_phone_verification' }
          })
        : Response.json({ code: 'TURNSTILE_TOKEN_INVALID', message: 'Rejected' }, { status: 403 })
    );
    await expect(sendPhoneVerification(test.options)).rejects.toMatchObject({
      code: 'TURNSTILE_TOKEN_INVALID'
    });
    expect(test.fetchImpl).toHaveBeenCalledTimes(3);
    expect(test.getChallengeToken).toHaveBeenCalledOnce();
  });
});
