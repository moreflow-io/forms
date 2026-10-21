import { describe, expect, it, vi } from 'vitest';
import { createFormsClient, createMemoryStorage } from './index';

const definition = {
  id: 'form-1', companyName: 'MPU West', language: 'en',
  version: { id: 'v1', formId: 'form-1', pages: [{ id: 'step', type: 'regular', components: [] }], fieldMatching: [], settings: {} }
};

describe('createFormsClient', () => {
  it('uses reusable defaults for definition loads, sessions, submission, and verification', async () => {
    const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
    const client = createFormsClient({
      baseUrl: '',
      acquisitionTracking: true,
      trackingCapture: () => ({ utm_source: 'client' }),
      storage: createMemoryStorage(),
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? '{}')) });
        if (init?.method === 'PUT') return Response.json({ challengeId: 'challenge', phoneNumber: '+491701234567' });
        if (url.endsWith('phone-verification')) return Response.json({ verified: true, phoneNumber: '+491701234567' });
        if (init?.method === 'POST') return Response.json({ id: 'submission' });
        return Response.json(definition);
      }
    });
    const form = await client.getPublicForm({ formId: 'form-1' });
    expect(form.formId).toBe('form-1');
    const session = client.createFormSession(form);
    expect(await session.submit()).toBe(true);
    expect(calls[1]?.body.tracking).toEqual({ utm_source: 'client' });
    const submit = await client.submitWithRetry({ formId: 'form-2', input: { data: {} }, acquisitionTracking: false });
    expect(submit.data).toEqual({ id: 'submission' });
    expect(calls[2]?.body).not.toHaveProperty('tracking');
    await client.sendPhoneVerification({ formId: 'form-1', phoneNumber: '+491701234567' });
    await client.checkPhoneVerification({ formId: 'form-1', phoneNumber: '+491701234567', challengeId: 'challenge', code: '123456' });
    expect(calls.map((call) => call.url)).toEqual([
      '/v1/forms/form-1', '/v1/forms/form-1/submissions', '/v1/forms/form-2/submissions',
      '/v1/forms/form-1/phone-verification', '/v1/forms/form-1/phone-verification'
    ]);
    session.dispose();
  });

  it('lets per-call transport options override defaults', async () => {
    const defaultFetch = vi.fn<typeof fetch>();
    const overrideFetch = vi.fn<typeof fetch>(async () => Response.json(definition));
    const client = createFormsClient({ baseUrl: 'https://default.test', fetchImpl: defaultFetch });
    await client.getPublicForm({ formId: 'form-1', baseUrl: 'https://override.test/', fetchImpl: overrideFetch });
    expect(defaultFetch).not.toHaveBeenCalled();
    expect(overrideFetch).toHaveBeenCalledWith('https://override.test/v1/forms/form-1', expect.anything());
  });

  it('gates callbacks on consent and lets explicit input tracking bypass capture', async () => {
    const trackingCapture = vi.fn(() => ({ utm_source: 'capture' }));
    const bodies: Record<string, unknown>[] = [];
    const client = createFormsClient({
      trackingCapture, acquisitionTracking: false, storage: createMemoryStorage(),
      fetchImpl: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({ id: 'submission' });
      }
    });
    await client.submitWithRetry({ formId: 'form-1', input: { data: {} } });
    expect(trackingCapture).not.toHaveBeenCalled();
    expect(bodies[0]).not.toHaveProperty('tracking');
    await client.submitWithRetry({ formId: 'form-1', input: { data: {} }, acquisitionTracking: true });
    expect(trackingCapture).toHaveBeenCalledTimes(1);
    expect(bodies[1]?.tracking).toEqual({ utm_source: 'capture' });
    await client.submitWithRetry({ formId: 'form-1', input: { data: {}, tracking: { utm_source: 'explicit' } }, acquisitionTracking: true });
    expect(trackingCapture).toHaveBeenCalledTimes(1);
    expect(bodies[2]?.tracking).toEqual({ utm_source: 'explicit' });
  });
});
