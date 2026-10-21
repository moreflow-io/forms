import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getPublicForm, type PublicFormDefinition } from './definition';
import { createFormSession, toFormSessionError } from './session';
import type {
  FormSession,
  FormSessionError,
  FormSessionOptions,
  FormSessionSnapshot
} from './session-types';

export interface UseMoreflowFormOptions extends FormSessionOptions {
  /** Loads the published form with `getPublicForm`. Ignored when `definition` is given. */
  formId?: string | undefined;
  /** A definition you loaded yourself, for example on the server. */
  definition?: PublicFormDefinition | undefined;
}

export type UseMoreflowFormResult =
  | { status: 'loading'; session: null; state: null; error: null }
  | { status: 'error'; session: null; state: null; error: FormSessionError }
  | { status: 'ready'; session: FormSession; state: FormSessionSnapshot; error: null };

const noSubscription = () => () => undefined;
const noSnapshot = () => null;

/**
 * Runs a Moreflow form in a React component: loads the definition (unless you
 * pass one), creates a {@link FormSession} for it and re-renders on every
 * change. Render from `state`, call actions on `session`.
 *
 * The session is created once per definition: options are read at that point,
 * so remount the component (for example with a `key`) to change `language`.
 */
export function useMoreflowForm(options: UseMoreflowFormOptions): UseMoreflowFormResult {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [loaded, setLoaded] = useState<{
    formId: string;
    definition?: PublicFormDefinition;
    error?: FormSessionError;
  } | null>(null);
  const { formId, baseUrl, token, definition: givenDefinition } = options;

  useEffect(() => {
    if (givenDefinition || !formId) return;
    const controller = new AbortController();
    const { headers, fetchImpl, language, formality, messages } = optionsRef.current;
    getPublicForm({ formId, baseUrl, token, headers, fetchImpl, signal: controller.signal }).then(
      (definition) => setLoaded({ formId, definition }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({ formId, error: toFormSessionError(error, { language, formality, messages }) });
      }
    );
    return () => controller.abort();
  }, [formId, baseUrl, token, givenDefinition]);

  const definition =
    givenDefinition ?? (loaded?.formId === formId ? loaded?.definition : undefined);
  const loadError = givenDefinition || loaded?.formId !== formId ? undefined : loaded?.error;

  const session = useMemo(
    () => (definition ? createFormSession(definition, optionsRef.current) : null),
    [definition]
  );
  useEffect(() => (session ? () => session.dispose() : undefined), [session]);

  const subscribe = useCallback(
    (listener: () => void) => (session ? session.subscribe(listener) : noSubscription()),
    [session]
  );
  const getSnapshot = useCallback(
    () => (session ? session.getSnapshot() : noSnapshot()),
    [session]
  );
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (session && state) return { status: 'ready', session, state, error: null };
  if (loadError) return { status: 'error', session: null, state: null, error: loadError };
  return { status: 'loading', session: null, state: null, error: null };
}

export type {
  FormSession,
  FormSessionError,
  FormSessionOptions,
  FormSessionSnapshot
} from './session-types';
