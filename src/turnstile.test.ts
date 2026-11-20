// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mountTurnstile: typeof import('./turnstile').mountTurnstile;

// The Window global belongs to apps/web; this package reads its own narrowed window type.
function turnstileWindow() {
  return window as Window & { turnstile?: unknown };
}

describe('mountTurnstile', () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ mountTurnstile } = await import('./turnstile'));
  });
  afterEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    delete turnstileWindow().turnstile;
  });

  it('loads the explicit browser API and exposes token, reset, and destroy controls', async () => {
    const callback = vi.fn();
    const reset = vi.fn();
    const remove = vi.fn();
    const render = vi.fn(
      (_container: HTMLElement, _options: { callback?: (token: string) => void }) => 'widget-1'
    );
    const api = {
      ready: vi.fn(() => {
        throw new Error(
          '[Cloudflare Turnstile] Remove async/defer from the Turnstile api.js script tag before using turnstile.ready()'
        );
      }),
      render,
      reset,
      remove
    };
    turnstileWindow().turnstile = api;
    const container = document.createElement('div');

    const mounted = await mountTurnstile(container, { siteKey: 'sitekey', onToken: callback });
    mounted.reset();
    mounted.destroy();
    mounted.destroy();

    expect(render).toHaveBeenCalledWith(
      container,
      expect.objectContaining({ sitekey: 'sitekey', 'response-field': false })
    );
    render.mock.calls[0]?.[1].callback?.('preloaded-token');
    expect(callback).toHaveBeenCalledWith('preloaded-token');
    expect(reset).toHaveBeenCalledWith('widget-1');
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('injects the Cloudflare script before explicitly rendering when the API is not present', async () => {
    const callback = vi.fn();
    const ready = vi.fn(() => {
      throw new Error(
        '[Cloudflare Turnstile] Remove async/defer from the Turnstile api.js script tag before using turnstile.ready()'
      );
    });
    const render = vi.fn(
      (_container: HTMLElement, _options: { callback?: (token: string) => void }) => 'widget-2'
    );
    const mounting = mountTurnstile(document.createElement('div'), {
      siteKey: 'sitekey',
      onToken: callback
    });
    const secondMounting = mountTurnstile(document.createElement('div'), { siteKey: 'second-key' });
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]'
    );
    expect(script?.async).toBe(true);
    expect(document.querySelectorAll('script[src*="challenges.cloudflare.com/turnstile"]')).toHaveLength(1);
    expect(render).not.toHaveBeenCalled();

    const api = {
      ready,
      render,
      reset: vi.fn(),
      remove: vi.fn()
    };
    turnstileWindow().turnstile = api;
    script?.dispatchEvent(new Event('load'));

    await Promise.all([mounting, secondMounting]);
    expect(render).toHaveBeenCalledTimes(2);
    expect(ready).not.toHaveBeenCalled();
    render.mock.calls[0]?.[1].callback?.('loaded-token');
    expect(callback).toHaveBeenCalledWith('loaded-token');
  });
});
