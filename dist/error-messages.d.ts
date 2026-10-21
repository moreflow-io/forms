import type { FormCopyOptions } from './messages';
export interface LocalizedFormErrorOptions extends FormCopyOptions {
    /** Shown for errors without known copy; defaults to the localized `REQUEST_FAILED` text. */
    fallback?: string | undefined;
}
/**
 * The visitor-facing text for a failure: the `messages.errors` override for
 * its code, else the package copy for the code, else a connection hint for
 * retryable failures, else `fallback`.
 */
export declare function localizedFormErrorMessage(error: unknown, options?: LocalizedFormErrorOptions): string;
