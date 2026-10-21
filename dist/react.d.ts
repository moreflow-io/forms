import { type PublicFormDefinition } from './definition';
import type { FormSession, FormSessionError, FormSessionOptions, FormSessionSnapshot } from './session-types';
export interface UseMoreflowFormOptions extends FormSessionOptions {
    /** Loads the published form with `getPublicForm`. Ignored when `definition` is given. */
    formId?: string | undefined;
    /** A definition you loaded yourself, for example on the server. */
    definition?: PublicFormDefinition | undefined;
}
export type UseMoreflowFormResult = {
    status: 'loading';
    session: null;
    state: null;
    error: null;
} | {
    status: 'error';
    session: null;
    state: null;
    error: FormSessionError;
} | {
    status: 'ready';
    session: FormSession;
    state: FormSessionSnapshot;
    error: null;
};
/**
 * Runs a Moreflow form in a React component: loads the definition (unless you
 * pass one), creates a {@link FormSession} for it and re-renders on every
 * change. Render from `state`, call actions on `session`.
 *
 * The session is created once per definition: options are read at that point,
 * so remount the component (for example with a `key`) to change `language`.
 */
export declare function useMoreflowForm(options: UseMoreflowFormOptions): UseMoreflowFormResult;
export type { FormSession, FormSessionError, FormSessionOptions, FormSessionSnapshot } from './session-types';
