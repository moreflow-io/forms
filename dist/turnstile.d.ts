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
/**
 * Optional browser rendering helper for a discovered managed Turnstile site
 * key. The package remains headless unless a consumer explicitly calls this.
 */
export declare function mountTurnstile(container: HTMLElement, options: TurnstileMountOptions): Promise<MountedTurnstile>;
