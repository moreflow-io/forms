import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFormsClient, createMemoryStorage } from './index';

function stubTracker(tracker: unknown) {
  vi.stubGlobal('window', { moreflowAnalytics: tracker });
}

const respond = (body: unknown, status = 200) => async () => Response.json(body, { status });

function client(fetchImpl: () => Promise<Response>, maxAttempts?: number) {
  return createFormsClient({
    baseUrl: '',
    acquisitionTracking: false,
    storage: createMemoryStorage(),
    fetchImpl,
    ...(maxAttempts === undefined ? {} : { maxAttempts })
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a successful form submission records the form_submitted conversion (website-analytics §6.1)', () => {
  it('tracks the event with the form id only, and no contact id, email or field value', async () => {
    const track = vi.fn();
    stubTracker({ track, identify: () => true });
    await client(respond({ id: 's', clientId: '3f2b6c1e-7a4d-4e8b-9c0d-1a2b3c4d5e6f' })).submitWithRetry({
      formId: 'form-1',
      input: { data: { email: 'ada@example.test' } }
    });
    expect(track).toHaveBeenCalledExactlyOnceWith('form_submitted', { form_id: 'form-1' });
  });

  it('tracks without consent: no identify, and no event on a failed submission or without the tracker', async () => {
    const track = vi.fn();
    stubTracker({ track, identify: () => false });
    await client(respond({ id: 's' })).submitWithRetry({ formId: 'form-2', input: { data: {} } });
    expect(track).toHaveBeenCalledExactlyOnceWith('form_submitted', { form_id: 'form-2' });

    track.mockClear();
    await expect(client(respond({ code: 'VALIDATION_ERROR', message: 'x' }, 422), 1).submitWithRetry({ formId: 'form-3', input: { data: {} } })).rejects.toThrow();
    expect(track).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    await expect(client(respond({ id: 's' })).submitWithRetry({ formId: 'form-4', input: { data: {} } })).resolves.toBeDefined();
  });
});
