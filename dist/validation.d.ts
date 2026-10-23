import { type PublicFormComponent, type PublicFormDefinition, type PublicFormRegularPage, type VisitorVisibilityOptions } from './definition';
import type { JsonObject, JsonValue } from './json';
import { type NormalizePhoneNumberOptions } from './phone';
export type FormValidationCode = 'REQUIRED' | 'INVALID_EMAIL' | 'INVALID_PHONE_NUMBER' | 'CONSENT_REQUIRED' | 'INCOMPLETE_ADDRESS';
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
/**
 * The code for a required component left empty: consent boxes are
 * `CONSENT_REQUIRED`, everything else `REQUIRED`. Local validation and the
 * server's `VALIDATION_ERROR` mapping (`missingFieldIdsFromError`) both use it.
 */
export declare function missingComponentCode(componentType: string): FormValidationCode;
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
 * and values for hidden `tracking_consent` and `marketing_consent` checkboxes
 * are dropped (`companyName` defaults to `definition.companyName`, which keeps
 * a visible marketing box). Invalid phone values are left unchanged so validation (not submission) reports
 * them. Other values, including consent booleans, pass through untouched.
 */
export declare function prepareSubmissionData(definition: PublicFormDefinition, values: Record<string, JsonValue | undefined>, options?: FormValidationOptions): JsonObject;
