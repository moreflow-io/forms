export declare class MoreflowFormError extends Error {
    readonly status: number | undefined;
    readonly code: string | undefined;
    readonly retryable: boolean;
    readonly responseBody: unknown;
    constructor(options: {
        message: string;
        status?: number | undefined;
        code?: string | undefined;
        retryable?: boolean | undefined;
        responseBody?: unknown;
        cause?: unknown;
    });
}
export declare function retryableStatus(status: number): boolean;
export declare function readResponseBody(response: Response): Promise<unknown>;
/**
 * Extracts the navigational error code from a Moreflow API error body. Handles
 * both server shapes: operation failures (`{ error: { code } }`) and
 * route-level errors (`{ code }`).
 */
export declare function serverErrorCode(body: unknown): string | undefined;
/**
 * Extracts the human-readable server message from a Moreflow API error body
 * (`message`, `error` as a string, or `error.message`).
 */
export declare function serverErrorMessage(body: unknown): string | undefined;
/**
 * Returns the best human-readable message for a caught form helper error, so
 * embeds do not have to dig through `MoreflowFormError.responseBody` shapes
 * themselves. Falls back to `fallback` when nothing usable is found.
 */
export declare function formErrorMessage(error: unknown, fallback?: string): string;
