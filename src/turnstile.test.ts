// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountTurnstile } from './turnstile';

describe('mountTurnstile', () => {
  afterEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
    delete (window as Window & { turnstile?: unknown }).turnstile;
  });

  it('loads the explicit browser API and exposes token, reset, and destroy controls', async () => {
    const callback = vi.fn();
    const reset = vi.fn();
    const remove = vi.fn();
    const render = vi.fn(() => 'widget-1');
    (window as Window & { turnstile?: unknown }).turnstile = {
      ready: (ready: () => void) => ready(),
      render,
      reset,
      remove
    };
    const container = document.createElement('div');

    const mounted = await mountTurnstile(container, { siteKey: 'sitekey', onToken: callback });
    mounted.reset();
    mounted.destroy();
    mounted.destroy();

    expect(render).toHaveBeenCalledWith(
      container,
      expect.objectContaining({ sitekey: 'sitekey', 'response-field': false })
    );
    expect(reset).toHaveBeenCalledWith('widget-1');
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('injects the Cloudflare script before explicitly rendering when the API is not present', async () => {
    const render = vi.fn(() => 'widget-2');
    const mounting = mountTurnstile(document.createElement('div'), { siteKey: 'sitekey' });
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]'
    );
    expect(script).not.toBeNull();

    (window as Window & { turnstile?: unknown }).turnstile = {
      ready: (ready: () => void) => ready(),
      render,
      reset: vi.fn(),
      remove: vi.fn()
    };
    script?.dispatchEvent(new Event('load'));

    await mounting;
    expect(render).toHaveBeenCalledTimes(1);
  });
});
