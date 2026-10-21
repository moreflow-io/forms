import type { FormCopyOptions } from './messages';
import type { FormValidationIssue } from './validation';
/**
 * `language` defaults to `'de'`, like `resolveFormMessage`; `formality`
 * switches German to "du"; `messages.validation` replaces the text per code.
 */
export type ValidationMessageOptions = FormCopyOptions;
/**
 * The visitor-facing text for a validation issue in German or English, so an
 * embed can show `validateFormValues` results without its own translations.
 */
export declare function validationMessage(issue: Pick<FormValidationIssue, 'code'>, options?: ValidationMessageOptions): string;
