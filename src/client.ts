import { getPublicForm, type GetPublicFormOptions, type PublicFormDefinition } from './definition';
import {
  checkPhoneVerification,
  type CheckPhoneVerificationOptions,
  type PhoneVerificationRequestOptions,
  sendPhoneVerification
} from './phone-verification';
import { createFormSession } from './session';
import type { FormSessionOptions } from './session-types';
import { submitWithRetry, type SubmitWithRetryOptions } from './submission';

/** Reusable defaults; each call can override them with the same per-call options. */
export type CreateFormsClientOptions = FormSessionOptions;

/** Configure a forms integration once while keeping every operation independently callable. */
export function createFormsClient(defaults: CreateFormsClientOptions = {}) {
  return {
    getPublicForm(options: GetPublicFormOptions) {
      return getPublicForm({ ...defaults, ...options });
    },
    createFormSession(definition: PublicFormDefinition, options: FormSessionOptions = {}) {
      return createFormSession(definition, { ...defaults, ...options });
    },
    submitWithRetry<T = unknown>(options: SubmitWithRetryOptions) {
      return submitWithRetry<T>({ ...defaults, ...options });
    },
    sendPhoneVerification(options: PhoneVerificationRequestOptions) {
      return sendPhoneVerification({ ...defaults, ...options });
    },
    checkPhoneVerification(options: CheckPhoneVerificationOptions) {
      return checkPhoneVerification({ ...defaults, ...options });
    }
  };
}

export type FormsClient = ReturnType<typeof createFormsClient>;
