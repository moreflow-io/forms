import {
  CONSENT_COMPONENT_TYPES,
  DECLINABLE_CONSENT_COMPONENT_TYPES,
  isComponentVisibleToVisitors,
  PHONE_COMPONENT_TYPES,
  PRESENTATIONAL_COMPONENT_TYPES,
  partitionFormPages,
  type PublicFormComponent,
  type PublicFormDefinition,
  type PublicFormRegularPage,
  type VisitorVisibilityOptions,
  withDefinitionCompanyName
} from './definition';
import { isRecord } from './internal/values';
import type { JsonObject, JsonValue } from './json';
import { normalizePhoneNumber, type NormalizePhoneNumberOptions } from './phone';
import { validationMessage } from './validation-messages';

export type FormValidationCode =
  | 'REQUIRED'
  | 'INVALID_EMAIL'
  | 'INVALID_PHONE_NUMBER'
  | 'CONSENT_REQUIRED'
  | 'INCOMPLETE_ADDRESS';

export interface FormValidationIssue {
  componentId: string;
  componentType: string;
  code: FormValidationCode;
  /** The English text; show `validationMessage(issue, { language })` to visitors instead. */
  message: string;
}

/**
 * Phone parsing options plus the `companyName` your page shows, which decides
 * whether a `marketing_consent` box is visible (see `isComponentVisibleToVisitors`).
 */
export type FormValidationOptions = NormalizePhoneNumberOptions & VisitorVisibilityOptions;

// Same pattern the canonical Moreflow renderer uses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function issue(component: PublicFormComponent, code: FormValidationCode): FormValidationIssue {
  return {
    componentId: component.id,
    componentType: component.type,
    code,
    message: validationMessage({ code }, { language: 'en' })
  };
}

/**
 * The code for a required component left empty: consent boxes are
 * `CONSENT_REQUIRED`, everything else `REQUIRED`. Local validation and the
 * server's `VALIDATION_ERROR` mapping (`missingFieldIdsFromError`) both use it.
 */
export function missingComponentCode(componentType: string): FormValidationCode {
  return CONSENT_COMPONENT_TYPES.has(componentType) ? 'CONSENT_REQUIRED' : 'REQUIRED';
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function incompleteAddress(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return ['street', 'postal', 'city'].some(
    (field) => typeof value[field] !== 'string' || (value[field] as string).trim() === ''
  );
}

/**
 * Validates one component's value with the same rules the hosted Moreflow form
 * applies: required fields, consent checkboxes, email format, address
 * completeness, and full phone-number validation via libphonenumber. Returns
 * `null` when the value is acceptable or the component is presentational.
 */
export function validateComponentValue(
  component: PublicFormComponent,
  value: unknown,
  options: FormValidationOptions = {}
): FormValidationIssue | null {
  if (PRESENTATIONAL_COMPONENT_TYPES.has(component.type)) return null;
  // Hidden components never reach visitors, so they can never block submission.
  if (!isComponentVisibleToVisitors(component, options)) return null;

  if (CONSENT_COMPONENT_TYPES.has(component.type)) {
    if (component.required && !value) {
      return issue(component, missingComponentCode(component.type));
    }
    return null;
  }

  if (component.required && isEmptyValue(value)) {
    return issue(component, missingComponentCode(component.type));
  }
  if (component.required && component.type === 'address' && incompleteAddress(value)) {
    return issue(component, 'INCOMPLETE_ADDRESS');
  }

  if (typeof value === 'string' && value.trim() !== '') {
    if (component.type === 'email' && !EMAIL_PATTERN.test(value.trim())) {
      return issue(component, 'INVALID_EMAIL');
    }
    if (PHONE_COMPONENT_TYPES.has(component.type)) {
      const phone = normalizePhoneNumber(value, options);
      if (phone.status === 'invalid') {
        return issue(component, 'INVALID_PHONE_NUMBER');
      }
    }
  }

  return null;
}

/** Validates every component on one regular page against the entered values. */
export function validateFormPage(
  page: PublicFormRegularPage,
  values: Record<string, unknown>,
  options: FormValidationOptions = {}
): FormValidationIssue[] {
  return page.components.flatMap((component) => {
    const result = validateComponentValue(component, values[component.id], options);
    return result ? [result] : [];
  });
}

/** Validates the whole form (all regular pages) against the entered values. */
export function validateFormValues(
  definition: PublicFormDefinition,
  values: Record<string, unknown>,
  options: FormValidationOptions = {}
): FormValidationIssue[] {
  options = withDefinitionCompanyName(definition, options);
  return partitionFormPages(definition, options).steps.flatMap((page) =>
    validateFormPage(page, values, options)
  );
}

/**
 * Prepares entered values for `submitWithRetry`: phone fields are normalized
 * to E.164, empty phone fields are dropped, `undefined` entries are removed,
 * and values for hidden `tracking_consent` and `marketing_consent` checkboxes
 * are dropped (`companyName` defaults to `definition.companyName`, which keeps
 * a visible marketing box). Invalid phone values are left unchanged so validation (not submission) reports
 * them. Other values, including consent booleans, pass through untouched.
 */
export function prepareSubmissionData(
  definition: PublicFormDefinition,
  values: Record<string, JsonValue | undefined>,
  options: FormValidationOptions = {}
): JsonObject {
  options = withDefinitionCompanyName(definition, options);
  const data: JsonObject = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) data[key] = value;
  }

  for (const page of definition.pages) {
    if (page.type !== 'regular') continue;
    for (const component of page.components) {
      if (
        DECLINABLE_CONSENT_COMPONENT_TYPES.has(component.type) &&
        !isComponentVisibleToVisitors(component, options)
      ) {
        delete data[component.id];
        continue;
      }
      if (!PHONE_COMPONENT_TYPES.has(component.type)) continue;
      const value = data[component.id];
      if (typeof value !== 'string') continue;
      const phone = normalizePhoneNumber(value, options);
      if (phone.status === 'empty') delete data[component.id];
      if (phone.status === 'valid') data[component.id] = phone.e164;
    }
  }

  return data;
}
