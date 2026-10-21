/**
 * Default de/en copy for the `forms.*` message keys that Moreflow persists in
 * published form definitions (labels, placeholders, privacy texts, button
 * texts). Generated from the Moreflow message catalogs — do not edit values by
 * hand; regenerate them from `messages/de.json` and `messages/en.json`.
 */

export type FormMessageLanguage = 'de' | 'en';

export const FORM_MESSAGE_LANGUAGES: readonly FormMessageLanguage[] = ['de', 'en'];

const catalogDe: Record<string, string> = {
  forms_defaults_address_label: 'Adresse',
  forms_defaults_address_placeholder: 'Adresse suchen',
  forms_defaults_company_label: 'Firma',
  forms_defaults_company_placeholder: 'Firma eingeben',
  forms_defaults_continue_button_text: 'Weiter',
  forms_defaults_country_label: 'Land',
  forms_defaults_country_placeholder: 'Land auswählen',
  forms_defaults_date_label: 'Wähle ein Datum',
  forms_defaults_date_placeholder: 'TT.MM.JJJJ',
  forms_defaults_dropdown_label: 'Dropdown',
  forms_defaults_dropdown_option1: 'Option 1',
  forms_defaults_dropdown_option2: 'Option 2',
  forms_defaults_dropdown_placeholder: 'Auswählen',
  forms_defaults_email_label: 'E-Mail-Adresse',
  forms_defaults_email_placeholder: 'email@beispiel.de',
  forms_defaults_first_name_label: 'Vorname',
  forms_defaults_first_name_placeholder: 'Vorname eingeben',
  forms_defaults_heading_content: 'Überschrift',
  forms_defaults_heading_label: 'Überschrift',
  forms_defaults_iframe_label: 'Eingebetteter Inhalt',
  forms_defaults_image_label: 'Bild',
  forms_defaults_last_name_label: 'Nachname',
  forms_defaults_last_name_placeholder: 'Nachname eingeben',
  forms_defaults_marketing_consent_label: 'Marketing-Einwilligung',
  forms_defaults_number_label: 'Zahl',
  forms_defaults_number_placeholder: 'z.B. 42',
  forms_defaults_phone_number_label: 'Telefonnummer',
  forms_defaults_phone_number_placeholder: '+49',
  forms_defaults_privacy_policy_label: 'Datenschutzeinwilligung',
  forms_defaults_separator_label: 'Trennlinie',
  forms_defaults_spacing_label: 'Abstand',
  forms_defaults_submit_button_text: 'Absenden',
  forms_defaults_text_label: 'Textfeld',
  forms_defaults_text_placeholder: 'Text eingeben',
  forms_defaults_tracking_consent_label: 'E-Mail-Tracking-Einwilligung',
  forms_defaults_video_label: 'Video',
  forms_privacy_and: 'und',
  forms_privacy_consent_label:
    'Ich bin damit einverstanden, dass die {companyName} meine persönlichen Daten zur Verwaltung und zur Bereitstellung der von mir angeforderten Dienstleistungen speichert.',
  forms_privacy_i_agree: 'Ich stimme zu.',
  forms_privacy_i_have_read_and_agree: 'Ich habe die',
  forms_privacy_imprint: 'Impressum',
  forms_privacy_privacy_policy: 'Datenschutzbestimmungen',
  forms_privacy_read_and_agree: 'gelesen und stimme zu.',
  forms_privacy_terms_of_service: 'AGB',
  forms_privacy_the: 'das',
  forms_settings_back_to_form: 'Zurück zum Formular',
  forms_settings_continue_button: 'Weiter',
  forms_settings_submit_button: 'Absenden',
  forms_settings_tags_description:
    'Wähle Tags aus, die dem Kontakt automatisch hinzugefügt werden sollen, wenn das Formular abgesendet wird.',
  forms_settings_tags_title: 'Tags',
  forms_types_address: 'Adresse',
  forms_types_company: 'Firma',
  forms_types_country: 'Land',
  forms_types_date: 'Datum',
  forms_types_dropdown: 'Dropdown',
  forms_types_email: 'E-Mail',
  forms_types_first_name: 'Vorname',
  forms_types_heading: 'Überschrift',
  forms_types_iframe: 'Eingebetteter Inhalt',
  forms_types_image: 'Bild',
  forms_types_last_name: 'Nachname',
  forms_types_marketing_consent: 'Marketing-Einwilligung (optional)',
  forms_types_multiple_choice: 'Mehrfachauswahl',
  forms_types_number: 'Zahl',
  forms_types_phone_number: 'Telefon',
  forms_types_privacy_policy: 'Datenschutzeinwilligung',
  forms_types_separator: 'Trennlinie',
  forms_types_spacing: 'Abstand',
  forms_types_textarea: 'Textbereich',
  forms_types_tracking_consent: 'E-Mail-Tracking-Einwilligung',
  forms_types_video: 'Video',
  public_marketing_consent_label:
    'Ich möchte Neuigkeiten und Angebote von {companyName} per E-Mail erhalten. Diese Einwilligung kann ich jederzeit widerrufen.'
};

const catalogEn: Record<string, string> = {
  forms_defaults_address_label: 'Address',
  forms_defaults_address_placeholder: 'Search address',
  forms_defaults_company_label: 'Company',
  forms_defaults_company_placeholder: 'Enter company',
  forms_defaults_continue_button_text: 'Continue',
  forms_defaults_country_label: 'Country',
  forms_defaults_country_placeholder: 'Select country',
  forms_defaults_date_label: 'Select a date',
  forms_defaults_date_placeholder: 'MM/DD/YYYY',
  forms_defaults_dropdown_label: 'Dropdown',
  forms_defaults_dropdown_option1: 'Option 1',
  forms_defaults_dropdown_option2: 'Option 2',
  forms_defaults_dropdown_placeholder: 'Select',
  forms_defaults_email_label: 'Email address',
  forms_defaults_email_placeholder: 'email@example.com',
  forms_defaults_first_name_label: 'First name',
  forms_defaults_first_name_placeholder: 'Enter first name',
  forms_defaults_heading_content: 'Heading',
  forms_defaults_heading_label: 'Heading',
  forms_defaults_iframe_label: 'Embedded content',
  forms_defaults_image_label: 'Image',
  forms_defaults_last_name_label: 'Last name',
  forms_defaults_last_name_placeholder: 'Enter last name',
  forms_defaults_marketing_consent_label: 'Marketing consent',
  forms_defaults_number_label: 'Number',
  forms_defaults_number_placeholder: 'e.g. 42',
  forms_defaults_phone_number_label: 'Phone number',
  forms_defaults_phone_number_placeholder: '+1',
  forms_defaults_privacy_policy_label: 'Privacy consent',
  forms_defaults_separator_label: 'Separator',
  forms_defaults_spacing_label: 'Spacing',
  forms_defaults_submit_button_text: 'Submit',
  forms_defaults_text_label: 'Text field',
  forms_defaults_text_placeholder: 'Enter text',
  forms_defaults_tracking_consent_label: 'Email tracking consent',
  forms_defaults_video_label: 'Video',
  forms_privacy_and: 'and',
  forms_privacy_consent_label:
    'I agree that {companyName} may store my personal data for managing and providing the services I have requested.',
  forms_privacy_i_agree: 'I agree.',
  forms_privacy_i_have_read_and_agree: 'I have read the',
  forms_privacy_imprint: 'Imprint',
  forms_privacy_privacy_policy: 'Privacy Policy',
  forms_privacy_read_and_agree: 'and agree.',
  forms_privacy_terms_of_service: 'Terms of Service',
  forms_privacy_the: 'the',
  forms_settings_back_to_form: 'Back to form',
  forms_settings_continue_button: 'Continue',
  forms_settings_submit_button: 'Submit',
  forms_settings_tags_description:
    'Select tags to automatically add to the contact when the form is submitted.',
  forms_settings_tags_title: 'Tags',
  forms_types_address: 'Address',
  forms_types_company: 'Company',
  forms_types_country: 'Country',
  forms_types_date: 'Date',
  forms_types_dropdown: 'Dropdown',
  forms_types_email: 'Email',
  forms_types_first_name: 'First name',
  forms_types_heading: 'Heading',
  forms_types_iframe: 'Embedded content',
  forms_types_image: 'Image',
  forms_types_last_name: 'Last name',
  forms_types_marketing_consent: 'Marketing consent (optional)',
  forms_types_multiple_choice: 'Multiple choice',
  forms_types_number: 'Number',
  forms_types_phone_number: 'Phone',
  forms_types_privacy_policy: 'Privacy consent',
  forms_types_separator: 'Separator',
  forms_types_spacing: 'Spacing',
  forms_types_textarea: 'Text area',
  forms_types_tracking_consent: 'Email tracking consent',
  forms_types_video: 'Video',
  public_marketing_consent_label:
    'I would like to receive news and offers from {companyName} by email. I can withdraw this consent at any time.'
};

/**
 * Default form copy keyed by normalized message id (see {@link formMessageId}).
 * `public_marketing_consent_label` is not a persisted `forms.*` key; render it
 * with {@link marketingConsentText}.
 */
export const formMessageCatalogs: Readonly<
  Record<FormMessageLanguage, Readonly<Record<string, string>>>
> = {
  de: catalogDe,
  en: catalogEn
};

const FORM_MESSAGE_KEY_PATTERN = /^forms\.(defaults|types|settings|privacy)\./u;

/** Whether a persisted label/placeholder value is a Moreflow message key rather than literal text. */
export function isFormMessageKey(value: string | null | undefined): boolean {
  return typeof value === 'string' && FORM_MESSAGE_KEY_PATTERN.test(value);
}

/**
 * Normalizes a persisted dotted key (`forms.privacy.iAgree`) to the catalog's
 * message id (`forms_privacy_i_agree`), the same way Moreflow's own renderer
 * resolves it.
 */
export function formMessageId(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/gu, '_')
    .replace(/_+/gu, '_')
    .replace(/^_|_$/gu, '')
    .toLowerCase();
}

/** How German copy addresses the visitor: `'formal'` ("Sie", the default) or `'informal'` ("du"). */
export type FormFormality = 'formal' | 'informal';

/**
 * Your own copy, replacing the package defaults for the language you render
 * in. Every text helper and `createFormSession` read the same map.
 */
export interface FormMessageOverrides {
  /**
   * Text for persisted `forms.*` message keys, keyed by the dotted key
   * (`forms.settings.submitButton`) or its message id
   * (`forms_settings_submit_button`).
   */
  forms?: Readonly<Record<string, string>> | undefined;
  /** Text per validation code, e.g. `{ CONSENT_REQUIRED: 'Bitte stimme zu.' }`. */
  validation?: Readonly<Partial<Record<string, string>>> | undefined;
  /** Text per error code (`FormErrorCode`), e.g. `{ FORM_NOT_FOUND: '...' }`. */
  errors?: Readonly<Partial<Record<string, string>>> | undefined;
}

/** The options every localized text helper accepts. */
export interface FormCopyOptions {
  /** Defaults to `'de'`; pass the language you render the form in. */
  language?: FormMessageLanguage | undefined;
  /** German only; defaults to `'formal'` ("Sie"). */
  formality?: FormFormality | undefined;
  messages?: FormMessageOverrides | undefined;
}

export interface ResolveFormMessageOptions {
  /** Target language; defaults to `'de'` (Moreflow's primary form language). */
  language?: FormMessageLanguage | undefined;
  /** Values for `{placeholder}` tokens, e.g. `{ companyName: 'ACME GmbH' }`. */
  params?: Record<string, string | number> | undefined;
  /** `messages.forms` replaces the default copy for a key. */
  messages?: FormMessageOverrides | undefined;
}

function interpolate(message: string, params: Record<string, string | number> | undefined) {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/gu, (token, name: string) => {
    const param = params[name];
    return param === undefined ? token : String(param);
  });
}

/**
 * Resolves a persisted label/placeholder value: message keys become your
 * `messages.forms` text or the default copy for the requested language
 * (falling back to the other language before giving up), literal text passes
 * through unchanged. Safe to call on every label a form definition provides.
 */
export function resolveFormMessage(
  value: string | null | undefined,
  options: ResolveFormMessageOptions = {}
): string {
  if (typeof value !== 'string' || !value) return '';
  if (!isFormMessageKey(value)) return value;

  const language = options.language ?? 'de';
  const id = formMessageId(value);
  const override = options.messages?.forms?.[value] ?? options.messages?.forms?.[id];
  if (override !== undefined) return interpolate(override, options.params);
  const fallbackLanguage: FormMessageLanguage = language === 'de' ? 'en' : 'de';
  const message = formMessageCatalogs[language][id] ?? formMessageCatalogs[fallbackLanguage][id];
  if (message === undefined) return value;
  return interpolate(message, options.params);
}

export interface MarketingConsentTextOptions {
  /**
   * The company name your page shows: the tenant brand's display name (the
   * company profile name in Moreflow), exactly as Moreflow's hosted form
   * shows it, because Moreflow rebuilds this text from that name to evidence
   * the consent.
   */
  companyName: string | null | undefined;
  /** Defaults to `'de'`; submit the same value as `input.locale`. */
  language?: FormMessageLanguage | undefined;
}

/**
 * The text of an optional `marketing_consent` checkbox: Moreflow's marketing
 * consent wording naming the company, in the visitor's language. Returns
 * `undefined` without a non-blank company name; the box must then stay hidden
 * (see `isComponentVisibleToVisitors`). Render the box unticked and send the
 * same `language` as `input.locale`, so the consent evidence Moreflow records
 * hashes the exact text the visitor saw.
 */
export function marketingConsentText(options: MarketingConsentTextOptions): string | undefined {
  const companyName = options.companyName?.trim();
  if (!companyName) return undefined;
  const template = formMessageCatalogs[options.language ?? 'de'].public_marketing_consent_label;
  return template?.replace('{companyName}', () => companyName);
}
