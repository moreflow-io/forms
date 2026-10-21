import type { FormCopyOptions } from './messages';
import type { FormValidationCode, FormValidationIssue } from './validation';

const validationMessages: Readonly<
  Record<'de' | 'deInformal' | 'en', Readonly<Record<FormValidationCode, string>>>
> = {
  de: {
    REQUIRED: 'Dieses Feld ist erforderlich.',
    INVALID_EMAIL: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    INVALID_PHONE_NUMBER: 'Bitte geben Sie eine gültige Telefonnummer ein.',
    CONSENT_REQUIRED: 'Ihre Einwilligung ist erforderlich.',
    INCOMPLETE_ADDRESS: 'Bitte füllen Sie alle erforderlichen Adressfelder aus.'
  },
  deInformal: {
    REQUIRED: 'Dieses Feld ist erforderlich.',
    INVALID_EMAIL: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    INVALID_PHONE_NUMBER: 'Bitte gib eine gültige Telefonnummer ein.',
    CONSENT_REQUIRED: 'Deine Einwilligung ist erforderlich.',
    INCOMPLETE_ADDRESS: 'Bitte fülle alle erforderlichen Adressfelder aus.'
  },
  en: {
    REQUIRED: 'This field is required.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    INVALID_PHONE_NUMBER: 'Please enter a valid phone number.',
    CONSENT_REQUIRED: 'Consent is required.',
    INCOMPLETE_ADDRESS: 'Please fill out all required address fields.'
  }
};

/**
 * `language` defaults to `'de'`, like `resolveFormMessage`; `formality`
 * switches German to "du"; `messages.validation` replaces the text per code.
 */
export type ValidationMessageOptions = FormCopyOptions;

/**
 * The visitor-facing text for a validation issue in German or English, so an
 * embed can show `validateFormValues` results without its own translations.
 */
export function validationMessage(
  issue: Pick<FormValidationIssue, 'code'>,
  options: ValidationMessageOptions = {}
): string {
  const override = options.messages?.validation?.[issue.code];
  if (override) return override;
  const language = options.language ?? 'de';
  const catalog =
    language === 'en' ? 'en' : options.formality === 'informal' ? 'deInformal' : 'de';
  return validationMessages[catalog][issue.code];
}
