import { MoreflowFormError } from './error';
import {
  abortedErrorInit,
  fetchUnavailableInit,
  networkErrorInit,
  operationErrorInit,
  validationErrorInit
} from './internal/errors';
import { readResponseBody, resolveBaseUrl, resolveFetch } from './internal/http';
import { isRecord } from './internal/values';
import type { JsonObject } from './json';
import type { FormMessageLanguage } from './messages';

export interface PublicFormOption {
  id?: string | undefined;
  value: string;
  label: string;
}

export interface PublicFormComponent {
  id: string;
  /** Component type, e.g. `text`, `email`, `phone_number`, `dropdown`, `privacy_policy`, `heading`. */
  type: string;
  /** Label text or a `forms.*` message key — resolve with `resolveFormMessage`. */
  label?: string | undefined;
  /** Placeholder text or a `forms.*` message key. */
  placeholder?: string | undefined;
  /** Read from `required`, falling back to the legacy persisted `isRequired` key. */
  required: boolean;
  showLabel?: boolean | undefined;
  showPlaceholder?: boolean | undefined;
  /** Normalized to objects; persisted string options become `{ value, label }`. */
  options?: PublicFormOption[] | undefined;
  /** Privacy checkbox text or a `forms.privacy.*` message key. */
  checkboxText?: string | undefined;
  /** Phone fields only: the embed must run phone verification before submitting. */
  verifyPhone?: boolean | undefined;
  importAs?: string | undefined;
  size?: string | undefined;
  /** The persisted component including every passthrough property. */
  raw: JsonObject;
}

export interface PublicFormThankYouItem {
  id: string;
  /** Content item type, e.g. `heading`, `text`, `image`. */
  type: string;
  props?: JsonObject | undefined;
  raw: JsonObject;
}

interface PublicFormPageBase {
  id: string;
  title?: string | undefined;
  description?: string | undefined;
  order?: number | undefined;
  raw: JsonObject;
}

export interface PublicFormRegularPage extends PublicFormPageBase {
  type: 'regular';
  components: PublicFormComponent[];
}

export interface PublicFormThankYouPage extends PublicFormPageBase {
  type: 'thank_you';
  content: PublicFormThankYouItem[];
}

export type PublicFormPage = PublicFormRegularPage | PublicFormThankYouPage;

export interface PublicFormFieldMatch {
  formFieldId: string;
  clientField: string;
}

export interface PublicFormTurnstileProtection {
  /** A public site key. The server-side secret is never part of a definition. */
  siteKey: string;
  mode: 'off' | 'flag' | 'require';
}

export interface PublicFormSpamProtection {
  turnstile: PublicFormTurnstileProtection;
}

/**
 * Standalone SDK projection of Moreflow's canonical AccountId brand.
 * Keep its structure compatible with types/domain/ids.ts without importing
 * private monorepo source into the published package.
 */
export type PublicFormAccountId = string & {
  readonly __tableName: 'accounts';
  readonly __domainId?: 'AccountId' | undefined;
};

/**
 * The published version's settings. The typed keys are read for you; every
 * other persisted setting passes through unchanged.
 */
export type PublicFormSettings = JsonObject & {
  /** Submit button text or a `forms.settings.*` message key — resolve with `resolveFormMessage`. */
  submitButtonText?: string;
  /** Continue button text or a `forms.*` message key. */
  continueButtonText?: string;
  /**
   * Where to send the visitor after a successful submission instead of the
   * thank-you page (read from `thankYouPageUrl` or the legacy
   * `thank_you_page_url`). Unvalidated; `createFormSession` only follows
   * absolute http(s) URLs.
   */
  thankYouPageUrl?: string;
};

export interface PublicFormDefinition {
  formId: string;
  accountId?: PublicFormAccountId | undefined;
  name?: string | undefined;
  /**
   * The tenant brand's display name (the company profile name in Moreflow)
   * that consent copy names. Moreflow rebuilds the `marketing_consent` text
   * from exactly this name to evidence the consent, and the helpers default
   * their `companyName` to it. Undefined when the tenant has none (the
   * marketing box then stays hidden) or the server predates the field.
   */
  companyName?: string | undefined;
  /**
   * The account's default form language. `createFormSession` renders and
   * submits in it unless you pass another `language`.
   */
  language?: FormMessageLanguage | undefined;
  /** Render an off-screen text input with this name and submit its value as `input.spam.honeypot`. */
  honeypotField: string;
  /** Discovery configuration for optional Turnstile mounting in a custom embed. */
  spamProtection: PublicFormSpamProtection;
  versionId?: string | undefined;
  versionNumber?: number | undefined;
  publishedAt?: string | undefined;
  settings: PublicFormSettings;
  pages: PublicFormPage[];
  /** Pass unchanged as `input.fieldMatching` to `submitWithRetry`. */
  fieldMatching: PublicFormFieldMatch[];
}

/** Component types that render content and never collect input. */
export const PRESENTATIONAL_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  'heading',
  'separator',
  'spacing',
  'image',
  'video',
  'iframe'
]);

export const PHONE_COMPONENT_TYPES: ReadonlySet<string> = new Set(['phone', 'phone_number']);

/**
 * Consent checkboxes. `tracking_consent` and `marketing_consent` are optional
 * by design (see {@link OPTIONAL_CONSENT_COMPONENT_TYPES}); the privacy
 * checkboxes acknowledge the privacy notice and may be required.
 */
export const CONSENT_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  'privacy_policy',
  'privacy_checkbox',
  'tracking_consent',
  'marketing_consent'
]);

/**
 * Consent checkboxes that are always optional and unticked: they never block
 * submission, whatever a definition's `required` flag says, and only a box the
 * visitor ticks grants anything. `tracking_consent` grants email tracking
 * consent; `marketing_consent` is the only form field that grants marketing
 * email consent.
 */
export const OPTIONAL_CONSENT_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  'tracking_consent',
  'marketing_consent'
]);

export interface VisitorVisibilityOptions {
  /**
   * The company name your page shows in its consent copy: the tenant brand's
   * display name (the company profile name in Moreflow). A
   * `marketing_consent` checkbox stays hidden without it. Helpers that take a
   * definition default it to `definition.companyName`.
   */
  companyName?: string | undefined;
}

/**
 * Whether a visitor should see and fill in a component. A `tracking_consent`
 * checkbox is hidden while its account-authored `checkboxText` is empty or
 * whitespace; Moreflow never supplies that legal wording itself. A
 * `marketing_consent` checkbox is hidden unless `options.companyName` is a
 * non-blank name, because its text names the company (see
 * `marketingConsentText`). Every other component is always visible.
 */
export function isComponentVisibleToVisitors(
  component: {
    type: string;
    checkboxText?: string | undefined;
  },
  options: VisitorVisibilityOptions = {}
): boolean {
  if (component.type === 'marketing_consent') {
    return typeof options.companyName === 'string' && options.companyName.trim().length > 0;
  }
  if (component.type !== 'tracking_consent') return true;
  return typeof component.checkboxText === 'string' && component.checkboxText.trim().length > 0;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function jsonObject(value: Record<string, unknown>): JsonObject {
  return value as JsonObject;
}

function normalizeOptions(value: unknown): PublicFormOption[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value.flatMap((entry): PublicFormOption[] => {
    if (typeof entry === 'string' && entry.trim()) return [{ value: entry, label: entry }];
    if (!isRecord(entry)) return [];
    const optionValue = stringValue(entry.value) ?? stringValue(entry.id);
    const label = stringValue(entry.label) ?? optionValue;
    if (!optionValue || !label) return [];
    const id = stringValue(entry.id);
    return [{ ...(id ? { id } : {}), value: optionValue, label }];
  });
  return options.length > 0 ? options : undefined;
}

function normalizeComponent(value: unknown): PublicFormComponent | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const type = stringValue(value.type);
  if (!id || !type) return null;
  const options = normalizeOptions(value.options);
  return {
    id,
    type,
    label: stringValue(value.label),
    placeholder: stringValue(value.placeholder),
    // Optional consent boxes are never required, whatever the persisted flag says.
    required: OPTIONAL_CONSENT_COMPONENT_TYPES.has(type)
      ? false
      : Boolean(value.required ?? value.isRequired),
    showLabel: typeof value.showLabel === 'boolean' ? value.showLabel : undefined,
    showPlaceholder: typeof value.showPlaceholder === 'boolean' ? value.showPlaceholder : undefined,
    ...(options ? { options } : {}),
    checkboxText: stringValue(value.checkboxText),
    ...(value.verifyPhone === true ? { verifyPhone: true } : {}),
    importAs: stringValue(value.importAs),
    size: stringValue(value.size),
    raw: jsonObject(value)
  };
}

function normalizeThankYouContent(page: Record<string, unknown>): PublicFormThankYouItem[] {
  const content = page.content;
  // Legacy string content renders as a single text block.
  if (typeof content === 'string' && content.trim()) {
    const id = stringValue(page.id) ?? 'thank-you';
    return [{ id: `${id}:content`, type: 'text', props: { content }, raw: { content } }];
  }
  if (!Array.isArray(content)) return [];
  return content.flatMap((entry): PublicFormThankYouItem[] => {
    if (!isRecord(entry)) return [];
    const id = stringValue(entry.id);
    const type = stringValue(entry.type);
    if (!id || !type) return [];
    return [
      {
        id,
        type,
        props: isRecord(entry.props) ? jsonObject(entry.props) : undefined,
        raw: jsonObject(entry)
      }
    ];
  });
}

function normalizePage(value: unknown, index: number): PublicFormPage | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id) ?? `page-${index + 1}`;
  const base: PublicFormPageBase = {
    id,
    title: stringValue(value.title),
    description: stringValue(value.description),
    order: typeof value.order === 'number' ? value.order : undefined,
    raw: jsonObject(value)
  };
  if (value.type === 'thank_you') {
    return { ...base, type: 'thank_you', content: normalizeThankYouContent(value) };
  }
  const components = Array.isArray(value.components)
    ? value.components.map(normalizeComponent).filter((component) => component !== null)
    : [];
  return { ...base, type: 'regular', components };
}

function normalizeFieldMatching(value: unknown): PublicFormFieldMatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PublicFormFieldMatch[] => {
    if (!isRecord(entry)) return [];
    const formFieldId = stringValue(entry.formFieldId) ?? stringValue(entry.form_field_id);
    const clientField = stringValue(entry.clientField) ?? stringValue(entry.client_field);
    return formFieldId && clientField ? [{ formFieldId, clientField }] : [];
  });
}

/** Reads the v1 `fieldMatching` first and the legacy snake_case alias second, source by source. */
function fieldMatchingFrom(...sources: unknown[]): PublicFormFieldMatch[] {
  for (const source of sources) {
    if (!isRecord(source)) continue;
    const matches = normalizeFieldMatching(source.fieldMatching);
    if (matches.length > 0) return matches;
    const legacyMatches = normalizeFieldMatching(source.field_matching);
    if (legacyMatches.length > 0) return legacyMatches;
  }
  return [];
}

function hasThankYouContentProps(candidate: Record<string, unknown>): boolean {
  const pages = candidate.pages;
  if (!Array.isArray(pages)) return false;
  return pages.some(
    (page) =>
      isRecord(page) &&
      page.type === 'thank_you' &&
      Array.isArray(page.content) &&
      page.content.some((item) => isRecord(item) && isRecord(item.props))
  );
}

function settingsFrom(value: unknown): PublicFormSettings {
  const settings: PublicFormSettings = isRecord(value) ? { ...jsonObject(value) } : {};
  for (const key of ['submitButtonText', 'continueButtonText'] as const) {
    if (typeof settings[key] !== 'string') delete settings[key];
  }
  const thankYouPageUrl = stringValue(settings.thankYouPageUrl) ?? stringValue(settings.thank_you_page_url);
  if (thankYouPageUrl) settings.thankYouPageUrl = thankYouPageUrl.trim();
  else delete settings.thankYouPageUrl;
  return settings;
}

function languageFrom(value: unknown): FormMessageLanguage | undefined {
  return value === 'de' || value === 'en' ? value : undefined;
}

function spamProtectionFrom(value: unknown): PublicFormSpamProtection {
  const source = isRecord(value) ? value : {};
  const turnstile = isRecord(source.turnstile) ? source.turnstile : {};
  const mode = stringValue(turnstile.mode);
  return {
    turnstile: {
      siteKey: stringValue(turnstile.siteKey) ?? '',
      mode: mode === 'flag' || mode === 'require' ? mode : 'off'
    }
  };
}

/**
 * Normalizes the public form response into one canonical
 * {@link PublicFormDefinition}.
 *
 * The clean v1 resource carries the form at the root (`id`, `name`,
 * `accountId`, `honeypotField`, `spamProtection`) and the published version as
 * `version` (camelCase `fieldMatching`). Responses from before v1 also carried
 * a `record` copy with `record.data.config.current_version`, a snake_case
 * `field_matching` alias and string options; those remain readable as a
 * fallback for embeds that still receive the legacy production shape. Where
 * both are present, the v1 field wins. Prefers the candidate whose thank-you
 * page still carries its content props.
 */
export function normalizePublicFormDefinition(
  body: unknown,
  options: { formId?: string | undefined } = {}
): PublicFormDefinition {
  const root = isRecord(body) ? body : {};
  const record = isRecord(root.record) ? root.record : undefined;
  const recordData = record && isRecord(record.data) ? record.data : undefined;
  const recordConfig = recordData && isRecord(recordData.config) ? recordData.config : undefined;

  const candidates = [
    root.version,
    recordConfig?.current_version,
    recordConfig?.currentVersion,
    recordData,
    record,
    root
  ].filter((candidate): candidate is Record<string, unknown> => {
    return isRecord(candidate) && Array.isArray(candidate.pages);
  });

  const selected = candidates.find(hasThankYouContentProps) ?? candidates[0];
  if (!selected) {
    throw new MoreflowFormError({
      message: 'The public form response does not contain any form pages.',
      code: 'INVALID_FORM_DEFINITION',
      retryable: false,
      responseBody: body
    });
  }

  const pages = (selected.pages as unknown[])
    .map((page, index) => normalizePage(page, index))
    .filter((page) => page !== null);

  const formId =
    stringValue(root.id) ??
    stringValue(selected.formId) ??
    stringValue(record?.id) ??
    options.formId;
  if (!formId) {
    throw new MoreflowFormError({
      message: 'The public form response does not identify the form.',
      code: 'INVALID_FORM_DEFINITION',
      retryable: false,
      responseBody: body
    });
  }

  const versionNumber = typeof selected.version === 'number' ? selected.version : undefined;
  // The public API response is an external payload boundary for the account ID brand.
  const accountId = (stringValue(root.accountId) ??
    stringValue(selected.accountId) ??
    stringValue(record?.accountId)) as PublicFormAccountId | undefined;
  return {
    formId,
    accountId,
    name: stringValue(root.name) ?? stringValue(recordData?.name) ?? stringValue(selected.name),
    companyName: stringValue(root.companyName)?.trim(),
    language: languageFrom(root.language),
    honeypotField: stringValue(root.honeypotField) ?? 'website',
    spamProtection: spamProtectionFrom(root.spamProtection),
    versionId: stringValue(selected.id) === formId ? undefined : stringValue(selected.id),
    versionNumber,
    publishedAt: stringValue(selected.publishedAt),
    settings: settingsFrom(selected.settings),
    pages,
    fieldMatching: fieldMatchingFrom(selected, root, recordData, record)
  };
}

export interface GetPublicFormOptions {
  formId: string;
  /**
   * The Moreflow API origin. Defaults to `https://api.moreflow.io`; pass `''`
   * to call your page's own origin behind a same-origin proxy.
   */
  baseUrl?: string | undefined;
  /** Sends `Authorization: Bearer <token>` with the request. */
  token?: string | undefined;
  headers?: Record<string, string> | undefined;
  fetchImpl?: typeof fetch | undefined;
  signal?: AbortSignal | undefined;
}

/**
 * Loads the published definition of a public form
 * (`GET /v1/forms/{formId}`) and returns it as one canonical
 * {@link PublicFormDefinition}, so embeds never have to probe response shapes.
 * Failures throw {@link MoreflowFormError} with the server's navigational code
 * (`FORM_NOT_FOUND`, `FORM_RETIRED`, `FORM_UNPUBLISHED`, ...).
 */
export async function getPublicForm(options: GetPublicFormOptions): Promise<PublicFormDefinition> {
  if (!options.formId.trim()) {
    throw new MoreflowFormError(validationErrorInit('formId', 'formId is required.'));
  }
  const fetchImpl = resolveFetch(options.fetchImpl);
  if (!fetchImpl) throw new MoreflowFormError(fetchUnavailableInit('@moreflow/forms'));

  const headers = new Headers(options.headers);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  const url = `${resolveBaseUrl({ baseUrl: options.baseUrl })}/v1/forms/${encodeURIComponent(options.formId)}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers,
      ...(options.signal ? { signal: options.signal } : {})
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new MoreflowFormError(
        abortedErrorInit('Loading the Moreflow form was aborted.', options.signal)
      );
    }
    throw new MoreflowFormError(
      networkErrorInit('The Moreflow form could not be loaded before a response was received.', error)
    );
  }

  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new MoreflowFormError(
      operationErrorInit({
        responseBody: body,
        status: response.status,
        fallbackMessage: 'The Moreflow form could not be loaded'
      })
    );
  }
  return normalizePublicFormDefinition(body, { formId: options.formId });
}

export interface PartitionedFormPages {
  /** Regular wizard pages in order. */
  steps: PublicFormRegularPage[];
  /** The thank-you page, when the form defines one. */
  thankYou: PublicFormThankYouPage | undefined;
}

/**
 * Splits the form into visitor-facing wizard steps and the thank-you page.
 * Components hidden from visitors (see {@link isComponentVisibleToVisitors})
 * are left out of `steps`, so embeds render only what they should show. Pass
 * another `companyName` than `definition.companyName` only if your page shows
 * another name (the consent evidence then no longer matches).
 */
export function partitionFormPages(
  definition: PublicFormDefinition,
  options: VisitorVisibilityOptions = {}
): PartitionedFormPages {
  options = withDefinitionCompanyName(definition, options);
  return {
    steps: definition.pages
      .filter((page): page is PublicFormRegularPage => page.type === 'regular')
      .map((page) => ({
        ...page,
        components: page.components.filter((component) =>
          isComponentVisibleToVisitors(component, options)
        )
      })),
    thankYou: definition.pages.find((page) => page.type === 'thank_you')
  };
}

/**
 * The options with `companyName` defaulted to the definition's, so the
 * marketing box follows the server's brand name unless the caller names one.
 */
export function withDefinitionCompanyName<T extends VisitorVisibilityOptions>(
  definition: Pick<PublicFormDefinition, 'companyName'>,
  options: T
): T {
  if (options.companyName !== undefined || !definition.companyName) return options;
  return { ...options, companyName: definition.companyName };
}

/** All visible input-collecting components across the form's regular pages. */
export function formInputComponents(
  definition: PublicFormDefinition,
  options: VisitorVisibilityOptions = {}
): PublicFormComponent[] {
  return partitionFormPages(definition, options).steps.flatMap((page) =>
    page.components.filter((component) => !PRESENTATIONAL_COMPONENT_TYPES.has(component.type))
  );
}

/**
 * Phone components that require SMS verification before submission. When this
 * is non-empty, run `sendPhoneVerification`/`checkPhoneVerification` for the
 * entered number and submit the verified E.164 value — the submission endpoint
 * does not enforce verification for you.
 */
export function phoneVerificationComponents(
  definition: PublicFormDefinition
): PublicFormComponent[] {
  return formInputComponents(definition).filter(
    (component) => PHONE_COMPONENT_TYPES.has(component.type) && component.verifyPhone === true
  );
}

export function phoneVerificationRequired(definition: PublicFormDefinition): boolean {
  return phoneVerificationComponents(definition).length > 0;
}
