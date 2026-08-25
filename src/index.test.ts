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
import type { AcquisitionTracking, PublicFormTracking, TrackingCaptureOptions } from './index';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('@moreflow/forms', () => {
  it('re-exports the acquisition tracking API without changing its form type alias', () => {
    const storage = createMemoryStorage();
    const options: TrackingCaptureOptions = {
      location: {
        href: 'https://example.test/contact?utm_source=google&gclid=click-1&fbclid=meta-1'
      },
      cookie: '_fbp=fb.1.123.456; _fbc=fb.1.123.meta-1',
      referrer: 'https://google.test/',
      storage
    };
    const tracking: PublicFormTracking = captureAcquisitionTracking(options);
    const canonicalTracking: AcquisitionTracking = tracking;

    expect(canonicalTracking).toMatchObject({
      utm_source: 'google',
      gclid: 'click-1',
      fbclid: 'meta-1',
      fbp: 'fb.1.123.456',
      fbc: 'fb.1.123.meta-1',
      referrer: 'https://google.test/'
    });
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
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      }
    } as unknown as Crypto);

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
    expect(
      createIdempotencyStore({ storage, storageKey: 'moreflow:idempotency:form-1' }).read()
    ).toBe(null);
  });

  it('sends token and custom headers on every attempt', async () => {
    const requests: Request[] = [];
    let calls = 0;

    await submitWithRetry({
      formId: 'form-auth-retry',
      input: { data: { name: 'Ada' } },
      tracking: {},
      token: 'mfo_first-token',
      headers: { 'X-Embed-Source': 'landing-page' },
      storage: createMemoryStorage(),
      baseUrl: 'https://example.test',
      fetchImpl: async (input, init) => {
        requests.push(new Request(input, init));
        calls += 1;
        return new Response(
          calls === 1 ? 'temporary failure' : '{"record":{"id":"submission-1"}}',
          {
            status: calls === 1 ? 503 : 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      },
      sleep: async () => {}
    });

    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.headers.get('Authorization')).toBe('Bearer mfo_first-token');
      expect(request.headers.get('X-Embed-Source')).toBe('landing-page');
      expect(request.headers.get('Content-Type')).toBe('application/json');
      expect(request.headers.get('Idempotency-Key')).toBeTruthy();
    }
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

  it('replays byte-identical bodies across separate calls despite changed tracking and auth tokens', async () => {
    const storage = createMemoryStorage();
    const bodies: string[] = [];
    const keys: string[] = [];
    const authorizationHeaders: string[] = [];
    const fetchImpl = (status: number) => async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      bodies.push(await request.text());
      keys.push(request.headers.get('Idempotency-Key') ?? '');
      authorizationHeaders.push(request.headers.get('Authorization') ?? '');
      return new Response(JSON.stringify({ record: { id: 'submission-1' } }), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    await expect(
      submitWithRetry({
        formId: 'form-1',
        input: { data: { name: 'Ada' }, consent: { marketing: true } },
        tracking: { gclid: 'click-1', referrer: 'https://first.test/' },
        token: 'mfo_first-token',
        storage,
        baseUrl: 'https://example.test',
        maxAttempts: 1,
        fetchImpl: fetchImpl(503)
      })
    ).rejects.toBeInstanceOf(MoreflowFormError);

    const result = await submitWithRetry({
      formId: 'form-1',
      input: { data: { name: 'Ada' }, consent: { marketing: true } },
      tracking: { gclid: 'click-2', referrer: 'https://second.test/' },
      token: 'mfo_replay-token',
      storage,
      baseUrl: 'https://example.test',
      maxAttempts: 1,
      fetchImpl: fetchImpl(200)
    });

    expect(keys[1]).toBe(keys[0]);
    expect(bodies[1]).toBe(bodies[0]);
    expect(bodies[0]).toContain('click-1');
    expect(authorizationHeaders).toEqual(['Bearer mfo_first-token', 'Bearer mfo_replay-token']);
    expect(result.idempotencyKey).toBe(keys[0]);
    expect(
      createIdempotencyStore({ storage, storageKey: 'moreflow:idempotency:form-1' }).read()
    ).toBe(null);
  });

  it('rotates the key when consent changes between calls', async () => {
    const storage = createMemoryStorage();
    const keys: string[] = [];
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get('Idempotency-Key') ?? '');
      return new Response('unavailable', { status: 503 });
    };

    for (const marketing of [true, false]) {
      await expect(
        submitWithRetry({
          formId: 'form-1',
          input: { data: { name: 'Ada' }, consent: { marketing } },
          tracking: {},
          storage,
          maxAttempts: 1,
          fetchImpl
        })
      ).rejects.toBeInstanceOf(MoreflowFormError);
    }

    expect(keys[0]).not.toBe(keys[1]);
  });

  it('survives a caller-provided storage that throws and keeps diverted values readable', async () => {
    let reads = 0;
    const brokenStorage = {
      getItem: () => {
        reads += 1;
        return null;
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      }
    };

    const first = captureAcquisitionTracking({
      location: { href: 'https://example.test/?utm_source=google' },
      cookie: '',
      storage: brokenStorage,
      persistenceKey: 'broken-storage-test'
    });
    expect(first.utm_source).toBe('google');
    expect(reads).toBeGreaterThan(0);

    const second = captureAcquisitionTracking({
      location: { href: 'https://example.test/other' },
      cookie: '',
      storage: brokenStorage,
      persistenceKey: 'broken-storage-test'
    });
    expect(second.utm_source).toBe('google');

    const result = await submitWithRetry({
      formId: 'form-broken-storage',
      input: { data: { name: 'Ada' } },
      tracking: {},
      storage: brokenStorage,
      fetchImpl: async () =>
        new Response(JSON.stringify({ record: { id: 'submission-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
    });
    expect(result.idempotencyKey).toBeTruthy();
  });

  it('keeps the default in-memory fallback alive across calls in the same session', async () => {
    vi.resetModules();
    const fresh = await import('./index');

    const first = fresh.captureAcquisitionTracking({
      location: { href: 'https://example.test/?gclid=click-9' },
      cookie: ''
    });
    expect(first.gclid).toBe('click-9');

    const second = fresh.captureAcquisitionTracking({
      location: { href: 'https://example.test/plain' },
      cookie: ''
    });
    expect(second.gclid).toBe('click-9');

    const store = fresh.createIdempotencyStore({ storageKey: 'fallback-attempt' });
    const attempt = await store.prepare({ data: { name: 'Ada' } });
    const replay = await fresh
      .createIdempotencyStore({ storageKey: 'fallback-attempt' })
      .prepare({ data: { name: 'Ada' } });
    expect(replay.key).toBe(attempt.key);
  });

  it('caps retry delays from oversized Retry-After headers', async () => {
    const waits: number[] = [];
    let calls = 0;
    await submitWithRetry({
      formId: 'form-1',
      input: { data: { name: 'Ada' } },
      tracking: {},
      storage: createMemoryStorage(),
      maxRetryDelayMs: 5000,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return new Response('slow down', { status: 429, headers: { 'Retry-After': '86400' } });
        }
        return new Response(JSON.stringify({ record: { id: 'submission-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      },
      sleep: async (milliseconds) => {
        waits.push(milliseconds);
      }
    });

    expect(waits).toEqual([5000]);
  });

  it('rejects phone numbers embedded inside prose', () => {
    expect(normalizePhoneNumber('Ruf mich an unter 0170 1234567 danke')).toEqual({
      status: 'invalid',
      input: 'Ruf mich an unter 0170 1234567 danke'
    });
    expect(normalizePhoneNumber('0170 1234567')).toEqual({
      status: 'valid',
      e164: '+491701234567'
    });
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
