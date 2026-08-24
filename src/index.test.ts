import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  captureAcquisitionTracking,
  createIdempotencyStore,
  createMemoryStorage,
  fingerprintPayload,
  MoreflowFormError,
  normalizePhoneNumber,
  normalizePhoneToE164,
  submitWithRetry
} from './index';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('@moreflow/forms', () => {
  it('captures and persists acquisition signals without losing cookie identifiers', () => {
    const storage = createMemoryStorage();
    const first = captureAcquisitionTracking({
      location: {
        href: 'https://example.test/contact?utm_source=google&gclid=click-1&fbclid=meta-1'
      },
      cookie: '_fbp=fb.1.123.456; _fbc=fb.1.123.meta-1',
      referrer: 'https://google.test/',
      storage
    });

    expect(first).toMatchObject({
      utm_source: 'google',
      gclid: 'click-1',
      fbclid: 'meta-1',
      fbp: 'fb.1.123.456',
      fbc: 'fb.1.123.meta-1',
      referrer: 'https://google.test/'
    });

    const second = captureAcquisitionTracking({
      location: { href: 'https://example.test/contact' },
      storage
    });
    expect(second.gclid).toBe('click-1');
    expect(second.utm_source).toBe('google');
  });

  it('reuses a key for an identical payload and rotates it after an edit', async () => {
    const storage = createMemoryStorage();
    const store = createIdempotencyStore({ storage, storageKey: 'form-attempt' });
    const first = await store.prepare({ formId: 'form-1', data: { name: 'Ada' } });
    const retry = await store.prepare({ data: { name: 'Ada' }, formId: 'form-1' });
    const edited = await store.prepare({ formId: 'form-1', data: { name: 'Grace' } });

    expect(retry).toEqual(first);
    expect(edited.key).not.toBe(first.key);
    expect(edited.payloadHash).not.toBe(first.payloadHash);
  });

  it('uses a stable djb2 fingerprint when crypto.subtle is unavailable', async () => {
    vi.stubGlobal(
      'crypto',
      {
        getRandomValues: (bytes: Uint8Array) => {
          bytes.fill(7);
          return bytes;
        }
      } as unknown as Crypto
    );

    const first = await fingerprintPayload({ formId: 'form-1', data: { name: 'Ada' } });
    const retry = await fingerprintPayload({ data: { name: 'Ada' }, formId: 'form-1' });

    expect(first).toMatch(/^djb2-[0-9a-f]{8}$/u);
    expect(retry).toBe(first);
  });

  it('retries the same serialized request and key, then clears the attempt on success', async () => {
    const storage = createMemoryStorage();
    const requests: Request[] = [];
    const waits: number[] = [];
    let calls = 0;
    const result = await submitWithRetry({
      formId: 'form-1',
      input: { data: { name: 'Ada' } },
      storage,
      baseUrl: 'https://example.test',
      tracking: { gclid: 'click-1' },
      fetchImpl: async (input, init) => {
        requests.push(new Request(input, init));
        calls += 1;
        if (calls === 1) return new Response('temporary failure', { status: 503 });
        return new Response(JSON.stringify({ record: { id: 'submission-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Idempotency-Replayed': 'true' }
        });
      },
      sleep: async (milliseconds) => {
        waits.push(milliseconds);
      }
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
      requests[1]?.headers.get('Idempotency-Key')
    );
    expect(await requests[0]?.text()).toBe(await requests[1]?.text());
    expect(waits).toEqual([250]);
    expect(result.replayed).toBe(true);
    expect(result.data).toEqual({ record: { id: 'submission-1' } });
    expect(createIdempotencyStore({ storage, storageKey: 'moreflow:idempotency:form-1' }).read()).toBe(
      null
    );
  });

  it('keeps a failed key for replay and exposes conflict recovery without rotating it', async () => {
    const storage = createMemoryStorage();
    let key: string | null = null;
    await expect(
      submitWithRetry({
        formId: 'form-1',
        input: { data: { name: 'Ada' } },
        storage,
        maxAttempts: 1,
        fetchImpl: async (_input, init) => {
          key = new Headers(init?.headers).get('Idempotency-Key');
          return new Response(JSON.stringify({ error: { code: 'IDEMPOTENCY_CONFLICT' } }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    ).rejects.toMatchObject({
      name: 'MoreflowFormError',
      status: 409,
      code: 'IDEMPOTENCY_CONFLICT',
      retryable: false
    });

    expect(key).toBeTruthy();
    expect(
      createIdempotencyStore({ storage, storageKey: 'moreflow:idempotency:form-1' }).read()?.key
    ).toBe(key);
  });

  it.each([429, 503])(
    'includes the final %s response body and code after retries are exhausted',
    async (status) => {
      await expect(
        submitWithRetry({
          formId: 'form-1',
          input: { data: { name: 'Ada' } },
          maxAttempts: 1,
          fetchImpl: async () =>
            new Response(JSON.stringify({ error: { code: 'TEMPORARY_FAILURE' } }), {
              status,
              headers: { 'Content-Type': 'application/json' }
            })
        })
      ).rejects.toMatchObject({
        status,
        code: 'TEMPORARY_FAILURE',
        retryable: true,
        responseBody: { error: { code: 'TEMPORARY_FAILURE' } }
      });
    }
  );

  it('normalizes valid phone numbers to E.164 and rejects invalid input', () => {
    expect(normalizePhoneNumber('+49 (170) 1234567')).toEqual({
      status: 'valid',
      e164: '+491701234567'
    });
    expect(normalizePhoneToE164('not a phone')).toBeNull();
  });

  it('uses a new key when the business payload changes', async () => {
    const storage = createMemoryStorage();
    const keys: string[] = [];
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const key = new Headers(init?.headers).get('Idempotency-Key');
      if (key) keys.push(key);
      return new Response(JSON.stringify({ error: { code: 'IDEMPOTENCY_CONFLICT' } }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    await expect(
      submitWithRetry({
        formId: 'form-1',
        input: { data: { name: 'Ada' } },
        storage,
        maxAttempts: 1,
        fetchImpl
      })
    ).rejects.toBeInstanceOf(MoreflowFormError);
    await expect(
      submitWithRetry({
        formId: 'form-1',
        input: { data: { name: 'Grace' } },
        storage,
        maxAttempts: 1,
        fetchImpl
      })
    ).rejects.toBeInstanceOf(MoreflowFormError);

    expect(keys[0]).not.toBe(keys[1]);
  });
});
