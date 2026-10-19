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
  forms_defaults_video_label: 'Video',
  forms_privacy_and: 'und',
  forms_privacy_consent_label:
    'Ich bin damit einverstanden, dass die {companyName} meine persönlichen Daten zur Verwaltung und zur Bereitstellung der von mir angeforderten Dienstleistungen speichert. Darüber hinaus darf ich mit weiteren Angeboten kontaktiert werden.',
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
  forms_types_multiple_choice: 'Mehrfachauswahl',
  forms_types_number: 'Zahl',
  forms_types_phone_number: 'Telefon',
  forms_types_privacy_policy: 'Datenschutzeinwilligung',
  forms_types_separator: 'Trennlinie',
  forms_types_spacing: 'Abstand',
  forms_types_textarea: 'Textbereich',
  forms_types_video: 'Video'
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
  forms_defaults_video_label: 'Video',
  forms_privacy_and: 'and',
  forms_privacy_consent_label:
    'I agree that {companyName} may store my personal data for managing and providing the services I have requested. Furthermore, I may be contacted with additional offers.',
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
  forms_types_multiple_choice: 'Multiple choice',
  forms_types_number: 'Number',
  forms_types_phone_number: 'Phone',
  forms_types_privacy_policy: 'Privacy consent',
  forms_types_separator: 'Separator',
  forms_types_spacing: 'Spacing',
  forms_types_textarea: 'Text area',
  forms_types_video: 'Video'
};

/** Default form copy keyed by normalized message id (see {@link formMessageId}). */
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

export interface ResolveFormMessageOptions {
  /** Target language; defaults to `'de'` (Moreflow's primary form language). */
  language?: FormMessageLanguage | undefined;
  /** Values for `{placeholder}` tokens, e.g. `{ companyName: 'ACME GmbH' }`. */
  params?: Record<string, string | number> | undefined;
}

/**
 * Resolves a persisted label/placeholder value: message keys become the
 * default copy for the requested language (falling back to the other language
 * before giving up), literal text passes through unchanged. Safe to call on
 * every label a form definition provides.
 */
export function resolveFormMessage(
  value: string | null | undefined,
  options: ResolveFormMessageOptions = {}
): string {
  if (typeof value !== 'string' || !value) return '';
  if (!isFormMessageKey(value)) return value;

  const language = options.language ?? 'de';
  const id = formMessageId(value);
  const fallbackLanguage: FormMessageLanguage = language === 'de' ? 'en' : 'de';
  const message = formMessageCatalogs[language][id] ?? formMessageCatalogs[fallbackLanguage][id];
  if (message === undefined) return value;
  if (!options.params) return message;
  return message.replace(/\{(\w+)\}/gu, (token, name: string) => {
    const param = options.params?.[name];
    return param === undefined ? token : String(param);
  });
}
