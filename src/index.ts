import {
  captureAcquisitionTracking,
  clearAcquisitionTracking,
  configureAcquisitionTracking,
  createMemoryStorage,
  guardStorage,
  resolveStorage,
  trackingKeys
} from '@moreflow/tracking';
import type { AcquisitionTrackingSetting } from './internal/acquisition-tracking';
export { isMoreflowError } from './internal/errors';

export type {
  AcquisitionTracking,
  AcquisitionTrackingConfig,
  StorageLike,
  TrackingCaptureOptions,
  TrackingKey
} from '@moreflow/tracking';
export type {
  GetPublicFormOptions,
  PartitionedFormPages,
  PublicFormAccountId,
  PublicFormComponent,
  PublicFormDefinition,
  PublicFormFieldMatch,
  PublicFormOption,
  PublicFormPage,
  PublicFormRegularPage,
  PublicFormSettings,
  PublicFormSpamProtection,
  PublicFormThankYouItem,
  PublicFormThankYouPage,
  PublicFormTurnstileProtection,
  VisitorVisibilityOptions
} from './definition';
export {
  CONSENT_COMPONENT_TYPES,
  DECLINABLE_CONSENT_COMPONENT_TYPES,
  formInputComponents,
  getPublicForm,
  isComponentVisibleToVisitors,
  normalizePublicFormDefinition,
  PHONE_COMPONENT_TYPES,
  PRESENTATIONAL_COMPONENT_TYPES, 
  partitionFormPages,
  phoneVerificationComponents,
  phoneVerificationRequired
} from './definition';
export type {
  FormErrorCode,
  FormErrorMessageOptions,
  MoreflowClientErrorCode,
  MoreflowErrorRecovery
} from './error';
export {
  formErrorMessage,
  MoreflowFormError,
  missingFieldIdsFromError,
  serverErrorCode,
  serverErrorMessage
} from './error';
export type { JsonObject, JsonPrimitive, JsonValue } from './json';
export type {
  FormCopyOptions,
  FormFormality,
  FormMessageLanguage,
  FormMessageOverrides,
  MarketingConsentTextOptions,
  ResolveFormMessageOptions
} from './messages';
export {
  FORM_MESSAGE_LANGUAGES,
  formMessageCatalogs,
  formMessageId,
  isFormMessageKey,
  marketingConsentText,
  resolveFormMessage
} from './messages';
export type { NormalizedPhoneNumber, NormalizePhoneNumberOptions, PhoneInputParts } from './phone';
export {
  composePhoneNumber,
  countryCallingCode,
  DEFAULT_PHONE_COUNTRY,
  describePhoneInput,
  normalizePhoneNumber,
  normalizePhoneToE164
} from './phone';
export type {
  CheckPhoneVerificationOptions,
  PhoneVerificationChallenge,
  PhoneVerificationRequestOptions,
  PhoneVerificationResult
} from './phone-verification';
export { checkPhoneVerification, sendPhoneVerification } from './phone-verification';
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
} from './session';
export { createFormSession } from './session';
export type {
  IdempotencyAttempt,
  IdempotencyStore,
  PublicFormSubmissionInput,
  PublicFormTracking,
  SubmitWithRetryOptions,
  SubmitWithRetryResult
} from './submission';
export {
  createIdempotencyKey,
  createIdempotencyStore,
  fingerprintPayload,
  serializeForFingerprint,
  submitWithRetry
} from './submission';
export type { MountedTurnstile, TurnstileMountOptions } from './turnstile';
export { mountTurnstile } from './turnstile';
export type { FormValidationCode, FormValidationIssue, FormValidationOptions } from './validation';
export {
  prepareSubmissionData,
  validateComponentValue,
  validateFormPage,
  validateFormValues
} from './validation';
export type { ValidationMessageOptions } from './validation-messages';
export { validationMessage } from './validation-messages';
export type { AcquisitionTrackingSetting };
export {
  captureAcquisitionTracking,
  clearAcquisitionTracking,
  configureAcquisitionTracking,
  createMemoryStorage,
  guardStorage,
  resolveStorage,
  trackingKeys
};
export type { CreateFormsClientOptions, FormsClient } from './client';
export { createFormsClient } from './client';
