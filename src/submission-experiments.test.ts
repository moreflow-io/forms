import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageExperimentAssignments } from './internal/page-experiments';
import { createFormsClient, createMemoryStorage } from './index';

function stubTracker(tracker: unknown) {
  vi.stubGlobal('window', { moreflowAnalytics: tracker });
}

function recordingFetch(bodies: Array<Record<string, unknown>>) {
  return async (_input: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ id: 'submission' });
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('form submissions carry the page experiment variants', () => {
  it('sends the tracker assignments as experimentVariants without consent or storage', async () => {
    const getAssignments = vi.fn(() => [{ experiment: 'hero', variant: 'b' }]);
    stubTracker({ getAssignments });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: recordingFetch(bodies) });
    await client.submitWithRetry({ formId: 'form-1', input: { data: { email: 'a@example.test' } } });
    expect(getAssignments).toHaveBeenCalledTimes(1);
    expect(bodies[0]?.experimentVariants).toEqual([{ experiment: 'hero', variant: 'b' }]);
    expect(bodies[0]).not.toHaveProperty('tracking');
  });

  it('lets an explicit experimentVariants option replace the page assignments, and [] send none', async () => {
    stubTracker({ getAssignments: () => [{ experiment: 'hero', variant: 'b' }] });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: recordingFetch(bodies) });
    await client.submitWithRetry({ formId: 'form-1', input: { data: {}, experimentVariants: [{ experiment: 'cta', variant: 'control' }] } });
    await client.submitWithRetry({ formId: 'form-2', input: { data: {}, experimentVariants: [] } });
    expect(bodies[0]?.experimentVariants).toEqual([{ experiment: 'cta', variant: 'control' }]);
    expect(bodies[1]).not.toHaveProperty('experimentVariants');
  });

  it('omits the field without a tracker, on a server, or when the tracker throws', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const client = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: recordingFetch(bodies) });
    await client.submitWithRetry({ formId: 'form-1', input: { data: {} } });
    stubTracker({ getAssignments: () => { throw new Error('boom'); } });
    await client.submitWithRetry({ formId: 'form-2', input: { data: {} } });
    expect(bodies.map((body) => body.experimentVariants)).toEqual([undefined, undefined]);
    expect(pageExperimentAssignments()).toEqual([]);
  });

  it('reads only the tracker answer and ignores malformed entries', () => {
    stubTracker({ getAssignments: () => [{ experiment: 'hero', variant: 'b' }, { experiment: 1 }, null, 'x'] });
    expect(pageExperimentAssignments()).toEqual([{ experiment: 'hero', variant: 'b' }]);
    stubTracker({ getAssignments: () => 'not a list' });
    expect(pageExperimentAssignments()).toEqual([]);
  });

  it('touches no storage while reading the assignments', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
    stubTracker({ getAssignments: () => [{ experiment: 'hero', variant: 'b' }] });
    expect(pageExperimentAssignments()).toEqual([{ experiment: 'hero', variant: 'b' }]);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('a successful form submission identifies the visitor (website-analytics D-decision, option c)', () => {
  const clientId = '3f2b6c1e-7a4d-4e8b-9c0d-1a2b3c4d5e6f';
  const respond = (body: unknown) => async () => Response.json(body);

  it('passes the returned CRM client id to the tracker identify', async () => {
    const identify = vi.fn(() => true);
    stubTracker({ identify });
    const client = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: respond({ id: 's', clientId }) });
    await client.submitWithRetry({ formId: 'form-1', input: { data: {} } });
    expect(identify).toHaveBeenCalledExactlyOnceWith(clientId);
  });

  it('does not identify without a client id, on a failed submission, or without the tracker', async () => {
    const identify = vi.fn(() => true);
    stubTracker({ identify });
    const noClient = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: respond({ id: 's', clientId: null }) });
    await noClient.submitWithRetry({ formId: 'form-1', input: { data: {} } });
    const failing = createFormsClient({
      baseUrl: '',
      acquisitionTracking: false,
      storage: createMemoryStorage(),
      maxAttempts: 1,
      fetchImpl: async () => Response.json({ clientId, code: 'VALIDATION_ERROR', message: 'x' }, { status: 422 })
    });
    await expect(failing.submitWithRetry({ formId: 'form-2', input: { data: {} } })).rejects.toThrow();
    expect(identify).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    const withoutTracker = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: respond({ id: 's', clientId }) });
    await expect(withoutTracker.submitWithRetry({ formId: 'form-3', input: { data: {} } })).resolves.toBeDefined();
  });
});

describe('form submissions carry the page visit reference (docs/website-analytics.md §8.1)', () => {
  const visit = { eventId: 'b_abcdefgh12345678', at: '2026-11-10T12:00:00.000Z' };

  it('sends the tracker reference of the page view as visit', async () => {
    const visitRef = vi.fn(() => visit);
    stubTracker({ getAssignments: () => [], visitRef });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: recordingFetch(bodies) });
    await client.submitWithRetry({ formId: 'form-1', input: { data: {} } });
    expect(visitRef).toHaveBeenCalledTimes(1);
    expect(bodies[0]?.visit).toEqual(visit);
  });

  it('sends no visit when the tracker returns null (GPC, refusal, no pageview) or is absent', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const client = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: recordingFetch(bodies) });
    await client.submitWithRetry({ formId: 'form-1', input: { data: {} } });
    stubTracker({ getAssignments: () => [], visitRef: () => null });
    await client.submitWithRetry({ formId: 'form-2', input: { data: {} } });
    stubTracker({ getAssignments: () => [], visitRef: () => ({ eventId: 'not-an-id', at: visit.at }) });
    await client.submitWithRetry({ formId: 'form-3', input: { data: {} } });
    expect(bodies.map((body) => body.visit)).toEqual([undefined, undefined, undefined]);
  });
});
