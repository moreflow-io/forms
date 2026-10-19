import { type PublicFormComponent, type PublicFormDefinition, type PublicFormRegularPage } from './definition';
import { type JsonObject, type JsonValue } from './json';
import { type NormalizePhoneNumberOptions } from './phone';
export type FormValidationCode = 'REQUIRED' | 'INVALID_EMAIL' | 'INVALID_PHONE_NUMBER' | 'CONSENT_REQUIRED' | 'INCOMPLETE_ADDRESS';
export interface FormValidationIssue {
    componentId: string;
    componentType: string;
    code: FormValidationCode;
    /** Canonical English sentence; map `code` to your own translated copy instead of showing this verbatim. */
    message: string;
}
export type FormValidationOptions = NormalizePhoneNumberOptions;
/**
 * Validates one component's value with the same rules the hosted Moreflow form
 * applies: required fields, consent checkboxes, email format, address
 * completeness, and full phone-number validation via libphonenumber. Returns
 * `null` when the value is acceptable or the component is presentational.
 */
export declare function validateComponentValue(component: PublicFormComponent, value: unknown, options?: FormValidationOptions): FormValidationIssue | null;
/** Validates every component on one regular page against the entered values. */
export declare function validateFormPage(page: PublicFormRegularPage, values: Record<string, unknown>, options?: FormValidationOptions): FormValidationIssue[];
/** Validates the whole form (all regular pages) against the entered values. */
export declare function validateFormValues(definition: PublicFormDefinition, values: Record<string, unknown>, options?: FormValidationOptions): FormValidationIssue[];
/**
 * Prepares entered values for `submitWithRetry`: phone fields are normalized
 * to E.164, empty phone fields are dropped, `undefined` entries are removed,
 * and values for hidden `tracking_consent` checkboxes are dropped. Invalid
 * phone values are left unchanged so validation (not submission) reports
 * them. Other values, including consent booleans, pass through untouched.
 */
export declare function prepareSubmissionData(definition: PublicFormDefinition, values: Record<string, JsonValue | undefined>, options?: FormValidationOptions): JsonObject;
