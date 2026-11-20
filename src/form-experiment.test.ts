import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFormsClient, createMemoryStorage, getPublicForm } from './index';
import { experimentFromRender, mergeExperimentVariants, pageVisitorKey, trackExposure } from './form-experiment';

// Hosted form experiments on the embed (docs/website-analytics.md §7.3): the render sends a visitor key,
// records one exposure through the tracker, and the submission carries the assigned variant.

function stubWindow(tracker: unknown) {
  vi.stubGlobal('window', { moreflowAnalytics: tracker });
}

function renderFetch(urls: string[], experiment: unknown = { key: 'contact_short', variant: 'short' }) {
  return async (input: string | URL | Request) => {
    urls.push(String(input));
    return Response.json({ id: 'form-render', pages: [], ...(experiment === undefined ? {} : { experiment }) });
  };
}

function submitFetch(bodies: Array<Record<string, unknown>>) {
  return async (_input: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ id: 'submission' });
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hosted form experiments on the embed', () => {
  it('sends the page visitor key with the render, the same one on every render of the page view', async () => {
    stubWindow({});
    const urls: string[] = [];
    const fetchImpl = renderFetch(urls);
    await getPublicForm({ formId: 'form-visitor', baseUrl: '', fetchImpl });
    await getPublicForm({ formId: 'form-visitor', baseUrl: '', fetchImpl });
    const keys = urls.map((url) => new URL(url, 'https://x.test').searchParams.get('visitorKey'));
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(pageVisitorKey()).toBe(keys[0]);
  });

  it('lets an explicit visitorKey option replace the page key, and sends none without a window', async () => {
    const urls: string[] = [];
    vi.stubGlobal('window', undefined);
    await getPublicForm({ formId: 'form-server', baseUrl: '', fetchImpl: renderFetch(urls, undefined) });
    expect(urls[0]).toBe('/v1/forms/form-server');
    stubWindow({});
    await getPublicForm({ formId: 'form-explicit', baseUrl: '', visitorKey: 'analytics-visitor-1', fetchImpl: renderFetch(urls, undefined) });
    expect(urls[1]).toBe('/v1/forms/form-explicit?visitorKey=analytics-visitor-1');
  });

  it('records one exposure per render through the tracker, and exposes the assignment on the definition', async () => {
    const track = vi.fn();
    stubWindow({ track });
    const definition = await getPublicForm({ formId: 'form-exposure', baseUrl: '', fetchImpl: renderFetch([]) });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('exposure', { experiment: 'contact_short', variant: 'short' });
    expect(definition.experiment).toEqual({ experiment: 'contact_short', variant: 'short' });
  });

  it('renders without an exposure when the render has no assignment, and never fails on a broken tracker', async () => {
    const track = vi.fn();
    stubWindow({ track });
    const plain = await getPublicForm({ formId: 'form-plain', baseUrl: '', fetchImpl: renderFetch([], null) });
    expect(track).not.toHaveBeenCalled();
    expect(plain.experiment).toBeUndefined();
    stubWindow({
      track: () => {
        throw new Error('tracker down');
      }
    });
    trackExposure({ experiment: 'x', variant: 'y' });
    const broken = await getPublicForm({ formId: 'form-broken', baseUrl: '', fetchImpl: renderFetch([], null) });
    expect(broken.experiment).toBeUndefined();
  });

  it('submits the form experiment variant first, merged with the page assignments and without duplicate keys', async () => {
    stubWindow({ getAssignments: () => [{ experiment: 'hero', variant: 'b' }, { experiment: 'contact_short', variant: 'control' }] });
    await getPublicForm({ formId: 'form-submit', baseUrl: '', fetchImpl: renderFetch([]) });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: submitFetch(bodies) });
    await client.submitWithRetry({ formId: 'form-submit', input: { data: { email: 'a@example.test' } } });
    expect(bodies[0]?.experimentVariants).toEqual([
      { experiment: 'contact_short', variant: 'short' },
      { experiment: 'hero', variant: 'b' }
    ]);
  });

  it('sends no variants for a form rendered without an assignment and touches no storage', async () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
    stubWindow({ track: vi.fn(), getAssignments: () => [] });
    await getPublicForm({ formId: 'form-none', baseUrl: '', fetchImpl: renderFetch([], null) });
    const bodies: Array<Record<string, unknown>> = [];
    const client = createFormsClient({ baseUrl: '', acquisitionTracking: false, storage: createMemoryStorage(), fetchImpl: submitFetch(bodies) });
    await client.submitWithRetry({ formId: 'form-none', input: { data: {} } });
    expect(bodies[0]).not.toHaveProperty('experimentVariants');
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});

describe('form experiment helpers', () => {
  it('reads only a well-formed render experiment and keeps the form assignment first', () => {
    expect(experimentFromRender({ experiment: { key: 'a', variant: 'b' } })).toEqual({ experiment: 'a', variant: 'b' });
    expect(experimentFromRender({ experiment: { key: 1 } })).toBeNull();
    expect(experimentFromRender({})).toBeNull();
    expect(
      mergeExperimentVariants({ experiment: 'a', variant: 'x' }, [
        { experiment: 'a', variant: 'y' },
        { experiment: 'b', variant: 'z' }
      ])
    ).toEqual([
      { experiment: 'a', variant: 'x' },
      { experiment: 'b', variant: 'z' }
    ]);
  });
});
