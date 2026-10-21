import {
  DECLINABLE_CONSENT_COMPONENT_TYPES,
  type PublicFormComponent,
  type PublicFormDefinition, 
  partitionFormPages,
  phoneVerificationComponents
} from './definition';
import { formErrorMessage, missingFieldIdsFromError } from './error';
import type { JsonObject, JsonValue } from './json';
import { type FormCopyOptions, marketingConsentText, resolveFormMessage } from './messages';
import { normalizePhoneNumber } from './phone';
import {
  checkPhoneVerification,
  type PhoneVerificationChallenge,
  sendPhoneVerification
} from './phone-verification';
import type {
  FormSession,
  FormSessionError,
  FormSessionIssue,
  FormSessionOptions,
  FormSessionPhoneVerification,
  FormSessionSnapshot
} from './session-types';
import { submitWithRetry } from './submission';
import { type MountedTurnstile, mountTurnstile } from './turnstile';
import {
  type FormValidationCode,
  type FormValidationIssue,
  prepareSubmissionData,
  validateComponentValue,
  validateFormPage,
  validateFormValues
} from './validation';
import { validationMessage } from './validation-messages';

export type {
  FormSession,
  FormSessionError,
  FormSessionIssue,
  FormSessionOptions,
  FormSessionPhoneVerification,
  FormSessionPhoneVerificationActions,
  FormSessionResult,
  FormSessionSnapshot,
  FormSessionStatus,
  FormSessionTurnstile,
  FormSessionTurnstileActions
} from './session-types';

type MutableState = Omit<
  FormSessionSnapshot,
  | 'definition'
  | 'language'
  | 'companyName'
  | 'steps'
  | 'step'
  | 'isFirstStep'
  | 'isLastStep'
  | 'progress'
  | 'labels'
>;

function redirectUrlFrom(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, globalThis.location?.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function errorCode(error: unknown): string {
  const code =
    error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : 'REQUEST_FAILED';
}

/** A caught failure as session state, with its localized message. */
export function toFormSessionError(error: unknown, copy: FormCopyOptions): FormSessionError {
  return {
    code: errorCode(error),
    message: formErrorMessage(error, copy),
    retryable: Boolean(
      error && typeof error === 'object' && (error as { retryable?: unknown }).retryable
    ),
    cause: error
  };
}

/**
 * A framework-agnostic store that runs a public form for a custom embed: wizard
 * steps, values, localized validation, phone verification, honeypot,
 * Turnstile, submission and the thank-you result. Render from `getSnapshot()`
 * and re-render on `subscribe`; the actions keep the hosted form's rules.
 */
export function createFormSession(
  definition: PublicFormDefinition,
  options: FormSessionOptions = {}
): FormSession {
  const language = options.language ?? definition.language ?? 'de';
  const companyName = options.companyName ?? definition.companyName;
  const copy: FormCopyOptions = {
    language,
    formality: options.formality,
    messages: options.messages
  };
  const visibility = { companyName, defaultCountry: options.defaultCountry };
  const { steps, thankYou } = partitionFormPages(definition, { companyName });
  const verificationComponent: PublicFormComponent | undefined =
    phoneVerificationComponents(definition)[0];
  const turnstileConfig = definition.spamProtection.turnstile;
  const turnstileEnabled = Boolean(turnstileConfig.siteKey) && turnstileConfig.mode !== 'off';
  const resolve = (value: string | null | undefined) =>
    resolveFormMessage(value, {
      language,
      messages: options.messages,
      ...(companyName ? { params: { companyName } } : {})
    });
  const labels = {
    submit:
      resolve(definition.settings.submitButtonText) || resolve('forms.settings.submitButton'),
    continue:
      resolve(definition.settings.continueButtonText) || resolve('forms.settings.continueButton')
  };

  let controller = new AbortController();
  let challenge: PhoneVerificationChallenge | undefined;
  let verifiedPhone: string | undefined;
  let mountedTurnstile: MountedTurnstile | undefined;
  const listeners = new Set<() => void>();

  function initialState(): MutableState {
    return {
      stepIndex: 0,
      values: { ...options.initialValues },
      issues: {},
      focusComponentId: undefined,
      status: 'editing',
      error: null,
      phoneVerification: verificationComponent
        ? {
            componentId: verificationComponent.id,
            status: 'idle',
            phoneNumber: undefined,
            code: '',
            expiresAt: undefined,
            error: null
          }
        : null,
      honeypot: { name: definition.honeypotField, value: '' },
      turnstile: {
        enabled: turnstileEnabled,
        mode: turnstileConfig.mode,
        siteKey: turnstileConfig.siteKey,
        token: null,
        status: turnstileEnabled ? 'loading' : 'disabled'
      },
      result: null
    };
  }

  function snapshotFrom(next: MutableState): FormSessionSnapshot {
    const lastIndex = Math.max(steps.length - 1, 0);
    return {
      ...next,
      definition,
      language,
      companyName,
      steps,
      step: steps[next.stepIndex],
      isFirstStep: next.stepIndex === 0,
      isLastStep: next.stepIndex >= lastIndex,
      progress:
        next.status === 'submitted' ? 1 : steps.length > 0 ? next.stepIndex / steps.length : 0,
      labels
    };
  }

  let snapshot = snapshotFrom(initialState());

  function update(patch: Partial<MutableState>) {
    snapshot = snapshotFrom({ ...snapshot, ...patch });
    for (const listener of listeners) listener();
  }

  const sessionError = (error: unknown) => toFormSessionError(error, copy);

  function issueFor(
    component: { id: string; type: string },
    code: FormValidationCode
  ): FormSessionIssue {
    return {
      componentId: component.id,
      componentType: component.type,
      code,
      message: validationMessage({ code }, copy)
    };
  }

  function issueMap(issues: readonly FormValidationIssue[]) {
    return Object.fromEntries(
      issues.map((issue) => [
        issue.componentId,
        issueFor({ id: issue.componentId, type: issue.componentType }, issue.code)
      ])
    );
  }

  function stepIndexOf(componentId: string): number {
    const index = steps.findIndex((step) =>
      step.components.some((component) => component.id === componentId)
    );
    return index === -1 ? snapshot.stepIndex : index;
  }

  function componentById(componentId: string): PublicFormComponent | undefined {
    for (const step of steps) {
      const component = step.components.find((candidate) => candidate.id === componentId);
      if (component) return component;
    }
    return undefined;
  }

  function verification(patch: Partial<FormSessionPhoneVerification>) {
    return snapshot.phoneVerification ? { ...snapshot.phoneVerification, ...patch } : null;
  }

  /** The values to submit: untouched visible consent boxes that grant consent are an explicit decline. */
  function submissionData(): JsonObject {
    const values: Record<string, JsonValue | undefined> = { ...snapshot.values };
    for (const step of steps) {
      for (const component of step.components) {
        if (DECLINABLE_CONSENT_COMPONENT_TYPES.has(component.type) && values[component.id] === undefined) {
          values[component.id] = false;
        }
      }
    }
    // Phone values become E.164, so a verified number submits exactly as it was checked.
    return prepareSubmissionData(definition, values, visibility);
  }

  function verificationPhone(): string | undefined {
    if (!verificationComponent) return undefined;
    const value = snapshot.values[verificationComponent.id];
    if (typeof value !== 'string') return undefined;
    const phone = normalizePhoneNumber(value, { defaultCountry: options.defaultCountry });
    return phone.status === 'valid' ? phone.e164 : undefined;
  }

  function resetTurnstileToken() {
    if (!turnstileEnabled) return;
    mountedTurnstile?.reset();
    update({ turnstile: { ...snapshot.turnstile, token: null, status: 'loading' } });
  }

  async function performSubmit(): Promise<boolean> {
    update({ status: 'submitting', error: null });
    const token = snapshot.turnstile.token;
    try {
      const response = await submitWithRetry({
        formId: definition.formId,
        input: {
          data: submissionData(),
          fieldMatching: definition.fieldMatching.map((match) => ({ ...match })),
          locale: language,
          spam: { honeypot: snapshot.honeypot.value, ...(token ? { turnstileToken: token } : {}) },
          ...(options.utmParams ? { utmParams: options.utmParams } : {}),
          ...(options.consent ? { consent: options.consent } : {})
        },
        acquisitionTracking: options.acquisitionTracking,
        trackingCapture: options.trackingCapture,
        baseUrl: options.baseUrl,
        token: options.token,
        headers: options.headers,
        fetchImpl: options.fetchImpl,
        storage: options.storage,
        maxAttempts: options.maxAttempts,
        signal: controller.signal
      });
      update({
        status: 'submitted',
        result: {
          submission: response.data,
          idempotencyKey: response.idempotencyKey,
          replayed: response.replayed,
          thankYou,
          redirectUrl: redirectUrlFrom(definition.settings.thankYouPageUrl)
        }
      });
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      const code = errorCode(error);
      if (code === 'ANTI_SPAM_INVALID' || code === 'ANTI_SPAM_REQUIRED') resetTurnstileToken();
      const missing = missingFieldIdsFromError(error).flatMap((id) => {
        const component = componentById(id);
        return component ? [issueFor(component, 'REQUIRED')] : [];
      });
      const firstMissing = missing[0];
      update({
        status: 'editing',
        error: sessionError(error),
        ...(firstMissing
          ? {
              issues: { ...snapshot.issues, ...Object.fromEntries(missing.map((issue) => [issue.componentId, issue])) },
              stepIndex: stepIndexOf(firstMissing.componentId),
              focusComponentId: firstMissing.componentId
            }
          : {})
      });
      return false;
    }
  }

  async function sendCode(): Promise<boolean> {
    const state = snapshot.phoneVerification;
    if (!verificationComponent || !state || state.status === 'sending' || state.status === 'checking') {
      return false;
    }
    const phoneNumber = verificationPhone();
    if (!phoneNumber) {
      update({
        status: 'editing',
        stepIndex: stepIndexOf(verificationComponent.id),
        issues: {
          ...snapshot.issues,
          [verificationComponent.id]: issueFor(
            verificationComponent,
            snapshot.values[verificationComponent.id] ? 'INVALID_PHONE_NUMBER' : 'REQUIRED'
          )
        },
        focusComponentId: verificationComponent.id
      });
      return false;
    }
    const pendingSubmit = snapshot.status === 'verifying';
    update({ phoneVerification: verification({ status: 'sending', error: null }) });
    try {
      challenge = await sendPhoneVerification({
        formId: definition.formId,
        phoneNumber,
        defaultCountry: options.defaultCountry,
        baseUrl: options.baseUrl,
        token: options.token,
        headers: options.headers,
        fetchImpl: options.fetchImpl,
        signal: controller.signal
      });
      update({
        phoneVerification: verification({
          status: 'code_sent',
          phoneNumber: challenge.phoneNumber,
          expiresAt: challenge.expiresAt,
          code: '',
          error: null
        })
      });
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      const failure = sessionError(error);
      if (challenge) {
        // A resend failed: keep the code panel open and show the error there.
        update({ phoneVerification: verification({ status: 'code_sent', error: failure }) });
      } else {
        update({
          status: 'editing',
          error: pendingSubmit ? failure : snapshot.error,
          phoneVerification: verification({ status: 'idle', error: failure })
        });
      }
      return false;
    }
  }

  async function verify(code?: string): Promise<boolean> {
    const state = snapshot.phoneVerification;
    if (!state || !challenge || state.status === 'checking' || state.status === 'sending') {
      return false;
    }
    const enteredCode = code ?? state.code;
    update({ phoneVerification: verification({ status: 'checking', code: enteredCode, error: null }) });
    try {
      const result = await checkPhoneVerification({
        formId: definition.formId,
        phoneNumber: challenge.phoneNumber,
        challengeId: challenge.challengeId,
        code: enteredCode,
        baseUrl: options.baseUrl,
        token: options.token,
        headers: options.headers,
        fetchImpl: options.fetchImpl,
        signal: controller.signal
      });
      verifiedPhone = result.phoneNumber;
      challenge = undefined;
      update({
        phoneVerification: verification({ status: 'verified', phoneNumber: result.phoneNumber, code: '' })
      });
    } catch (error) {
      if (controller.signal.aborted) return false;
      update({ phoneVerification: verification({ status: 'code_sent', error: sessionError(error) }) });
      return false;
    }
    return snapshot.status === 'verifying' ? performSubmit() : true;
  }

  function changeNumber() {
    if (!verificationComponent) return;
    challenge = undefined;
    update({
      status: snapshot.status === 'verifying' ? 'editing' : snapshot.status,
      stepIndex: stepIndexOf(verificationComponent.id),
      focusComponentId: verificationComponent.id,
      phoneVerification: verification({
        status: 'idle',
        phoneNumber: undefined,
        code: '',
        expiresAt: undefined,
        error: null
      })
    });
  }

  async function submit(): Promise<boolean> {
    if (snapshot.status !== 'editing') return false;
    const issues = validateFormValues(definition, snapshot.values, visibility);
    const first = issues[0];
    if (first) {
      update({
        issues: issueMap(issues),
        stepIndex: stepIndexOf(first.componentId),
        focusComponentId: first.componentId
      });
      return false;
    }
    update({ issues: {}, focusComponentId: undefined, error: null });
    if (turnstileEnabled && turnstileConfig.mode === 'require' && !snapshot.turnstile.token) {
      update({ error: sessionError({ code: 'ANTI_SPAM_REQUIRED' }) });
      return false;
    }
    const phone = verificationPhone();
    if (verificationComponent && phone && phone !== verifiedPhone) {
      update({ status: 'verifying' });
      await sendCode();
      return false;
    }
    return performSubmit();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setValue(componentId, value) {
      const { [componentId]: _cleared, ...issues } = snapshot.issues;
      const patch: Partial<MutableState> = {
        values: { ...snapshot.values, [componentId]: value },
        issues,
        focusComponentId: undefined
      };
      if (
        verificationComponent?.id === componentId &&
        snapshot.phoneVerification?.status === 'verified'
      ) {
        const phone =
          typeof value === 'string'
            ? normalizePhoneNumber(value, { defaultCountry: options.defaultCountry })
            : undefined;
        if (phone?.status !== 'valid' || phone.e164 !== verifiedPhone) {
          verifiedPhone = undefined;
          patch.phoneVerification = verification({ status: 'idle', phoneNumber: undefined });
        }
      }
      update(patch);
    },
    blur(componentId) {
      const component = componentById(componentId);
      const value = snapshot.values[componentId];
      if (!component || value === undefined || value === '') return;
      const issue = validateComponentValue(component, value, visibility);
      const { [componentId]: _previous, ...issues } = snapshot.issues;
      update({ issues: issue ? { ...issues, [componentId]: issueFor(component, issue.code) } : issues });
    },
    async next() {
      if (snapshot.status !== 'editing') return false;
      const step = snapshot.step;
      if (step) {
        const issues = validateFormPage(step, snapshot.values, visibility);
        const first = issues[0];
        if (first) {
          update({ issues: issueMap(issues), focusComponentId: first.componentId });
          return false;
        }
      }
      if (snapshot.isLastStep) return submit();
      update({ stepIndex: snapshot.stepIndex + 1, issues: {}, focusComponentId: undefined, error: null });
      return true;
    },
    back() {
      if (snapshot.status === 'verifying') {
        changeNumber();
        return true;
      }
      if (snapshot.status !== 'editing' || snapshot.stepIndex === 0) return false;
      update({ stepIndex: snapshot.stepIndex - 1, focusComponentId: undefined, error: null });
      return true;
    },
    submit,
    reset() {
      controller.abort();
      controller = new AbortController();
      challenge = undefined;
      verifiedPhone = undefined;
      mountedTurnstile?.reset();
      update(initialState());
    },
    setHoneypot(value) {
      update({ honeypot: { ...snapshot.honeypot, value } });
    },
    phoneVerification: {
      sendCode,
      setCode(code) {
        update({ phoneVerification: verification({ code, error: null }) });
      },
      verify,
      resend: sendCode,
      changeNumber
    },
    turnstile: {
      async mount(container) {
        if (!turnstileEnabled) return () => undefined;
        try {
          const widget = await mountTurnstile(container, {
            siteKey: turnstileConfig.siteKey,
            onToken: (token) => update({ turnstile: { ...snapshot.turnstile, token, status: 'ready' } }),
            onExpired: () =>
              update({ turnstile: { ...snapshot.turnstile, token: null, status: 'loading' } }),
            onError: () => update({ turnstile: { ...snapshot.turnstile, token: null, status: 'error' } })
          });
          mountedTurnstile = widget;
          return () => {
            widget.destroy();
            if (mountedTurnstile === widget) mountedTurnstile = undefined;
          };
        } catch (error) {
          update({
            turnstile: { ...snapshot.turnstile, status: 'error' },
            error: sessionError(error)
          });
          return () => undefined;
        }
      },
      setToken(token) {
        if (!turnstileEnabled) return;
        update({ turnstile: { ...snapshot.turnstile, token, status: token ? 'ready' : 'loading' } });
      },
      fail() {
        if (!turnstileEnabled) return;
        update({ turnstile: { ...snapshot.turnstile, token: null, status: 'error' } });
      }
    },
    message: resolve,
    marketingConsentText: () => marketingConsentText({ companyName, language }),
    dispose() {
      // The session stays usable afterwards (React StrictMode remounts reuse it).
      controller.abort();
      controller = new AbortController();
      mountedTurnstile?.destroy();
      mountedTurnstile = undefined;
    }
  };
}
