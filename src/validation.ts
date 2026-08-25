import {
  CONSENT_COMPONENT_TYPES,
  PHONE_COMPONENT_TYPES,
  PRESENTATIONAL_COMPONENT_TYPES,
  partitionFormPages,
  type PublicFormComponent,
  type PublicFormDefinition,
  type PublicFormRegularPage
} from './definition';
import { isRecord, type JsonObject, type JsonValue } from './json';
import { normalizePhoneNumber, type NormalizePhoneNumberOptions } from './phone';

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
  /** Canonical English sentence; map `code` to your own translated copy instead of showing this verbatim. */
  message: string;
}

export type FormValidationOptions = NormalizePhoneNumberOptions;

// Same pattern the canonical Moreflow renderer uses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function issue(
  component: PublicFormComponent,
  code: FormValidationCode,
  message: string
): FormValidationIssue {
  return { componentId: component.id, componentType: component.type, code, message };
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

  if (CONSENT_COMPONENT_TYPES.has(component.type)) {
    if (component.required && !value) {
      return issue(component, 'CONSENT_REQUIRED', 'Consent is required.');
    }
    return null;
  }

  if (component.required && isEmptyValue(value)) {
    return issue(component, 'REQUIRED', 'This field is required.');
  }
  if (component.required && component.type === 'address' && incompleteAddress(value)) {
    return issue(component, 'INCOMPLETE_ADDRESS', 'Please fill out all required address fields.');
  }

  if (typeof value === 'string' && value.trim() !== '') {
    if (component.type === 'email' && !EMAIL_PATTERN.test(value.trim())) {
      return issue(component, 'INVALID_EMAIL', 'Please enter a valid email address.');
    }
    if (PHONE_COMPONENT_TYPES.has(component.type)) {
      const phone = normalizePhoneNumber(value, options);
      if (phone.status === 'invalid') {
        return issue(component, 'INVALID_PHONE_NUMBER', 'Please enter a valid phone number.');
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
  return partitionFormPages(definition).steps.flatMap((page) =>
    validateFormPage(page, values, options)
  );
}

/**
 * Prepares entered values for `submitWithRetry`: phone fields are normalized
 * to E.164, empty phone fields are dropped, and `undefined` entries are
 * removed. Invalid phone values are left unchanged so validation (not
 * submission) reports them. Other values pass through untouched.
 */
export function prepareSubmissionData(
  definition: PublicFormDefinition,
  values: Record<string, JsonValue | undefined>,
  options: FormValidationOptions = {}
): JsonObject {
  const data: JsonObject = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) data[key] = value;
  }

  for (const page of partitionFormPages(definition).steps) {
    for (const component of page.components) {
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
