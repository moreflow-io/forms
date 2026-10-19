const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export type TurnstileMountOptions = {
  siteKey: string;
  action?: string | undefined;
  onToken?: ((token: string) => void) | undefined;
  onExpired?: (() => void) | undefined;
  onError?: (() => void) | undefined;
};

export type MountedTurnstile = {
  reset(): void;
  destroy(): void;
};

type TurnstileApi = {
  ready(callback: () => void): void;
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi | undefined };

let scriptPromise: Promise<TurnstileApi> | undefined;

function currentTurnstile() {
  return (window as TurnstileWindow).turnstile;
}

function loadTurnstileScript() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Turnstile can only be mounted in a browser.'));
  }
  const loaded = currentTurnstile();
  if (loaded) return Promise.resolve(loaded);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_URL}"]`
    );
    const script = existing ?? document.createElement('script');
    const complete = () => {
      const api = currentTurnstile();
      if (api) resolve(api);
      else {
        scriptPromise = undefined;
        reject(new Error('Turnstile loaded without its browser API.'));
      }
    };
    script.addEventListener('load', complete, { once: true });
    script.addEventListener(
      'error',
      () => {
        scriptPromise = undefined;
        reject(new Error('Turnstile browser script could not be loaded.'));
      },
      { once: true }
    );
    if (!existing) {
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      document.head.append(script);
    }
  });
  return scriptPromise;
}

/**
 * Optional browser rendering helper for a discovered managed Turnstile site
 * key. The package remains headless unless a consumer explicitly calls this.
 */
export async function mountTurnstile(
  container: HTMLElement,
  options: TurnstileMountOptions
): Promise<MountedTurnstile> {
  if (!options.siteKey.trim()) throw new Error('A Turnstile siteKey is required.');
  const api = await loadTurnstileScript();
  const widgetId = await new Promise<string>((resolve) => {
    api.ready(() => {
      resolve(
        api.render(container, {
          sitekey: options.siteKey,
          action: options.action ?? 'public_form',
          appearance: 'interaction-only',
          execution: 'render',
          theme: 'auto',
          'response-field': false,
          callback: options.onToken,
          'expired-callback': options.onExpired,
          'error-callback': options.onError
        })
      );
    });
  });
  let destroyed = false;
  return {
    reset() {
      if (!destroyed) api.reset(widgetId);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      api.remove(widgetId);
    }
  };
}
