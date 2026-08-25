import {
  MoreflowFormError,
  readResponseBody,
  retryableStatus,
  serverErrorCode,
  serverErrorMessage
} from './error';
import { isRecord, type JsonObject } from './json';

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
  /** Merged from the persisted `required`/`isRequired` duality. */
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

export interface PublicFormDefinition {
  formId: string;
  accountId?: string | undefined;
  name?: string | undefined;
  versionId?: string | undefined;
  versionNumber?: number | undefined;
  publishedAt?: string | undefined;
  settings: JsonObject;
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

export const CONSENT_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  'privacy_policy',
  'privacy_checkbox'
]);

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
    required: Boolean(value.required ?? value.isRequired),
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

function fieldMatchingFrom(...sources: unknown[]): PublicFormFieldMatch[] {
  for (const source of sources) {
    if (!isRecord(source)) continue;
    const matches = normalizeFieldMatching(source.fieldMatching ?? source.field_matching);
    if (matches.length > 0) return matches;
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

/**
 * Normalizes any shape the public form endpoint has historically returned into
 * one canonical {@link PublicFormDefinition}: the top-level `version`, the
 * legacy copy under `record.data.config.current_version`, snake_case
 * `field_matching`, string options, and the `required`/`isRequired` duality.
 * Prefers the candidate whose thank-you page still carries its content props.
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
    stringValue(selected.formId) ??
    stringValue(record?.id) ??
    stringValue(root.id) ??
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

  return {
    formId,
    accountId: stringValue(selected.accountId) ?? stringValue(record?.accountId),
    name: stringValue(recordData?.name) ?? stringValue(selected.name),
    versionId: stringValue(selected.id) === formId ? undefined : stringValue(selected.id),
    versionNumber,
    publishedAt: stringValue(selected.publishedAt),
    settings: isRecord(selected.settings) ? jsonObject(selected.settings) : {},
    pages,
    fieldMatching: fieldMatchingFrom(selected, root, recordData, record)
  };
}

export interface GetPublicFormOptions {
  formId: string;
  /** Defaults to `''`, i.e. the page's own origin behind a same-origin proxy. */
  baseUrl?: string | undefined;
  /** Sends `Authorization: Bearer <token>` with the request. */
  token?: string | undefined;
  headers?: Record<string, string> | undefined;
  fetchImpl?: typeof fetch | undefined;
  signal?: AbortSignal | undefined;
}

/**
 * Loads the published definition of a public form
 * (`GET /api/v1/forms/{formId}`) and returns it as one canonical
 * {@link PublicFormDefinition}, so embeds never have to probe response shapes.
 * Failures throw {@link MoreflowFormError} with the server's navigational code
 * (`FORM_NOT_FOUND`, `FORM_RETIRED`, `FORM_UNPUBLISHED`, ...).
 */
export async function getPublicForm(options: GetPublicFormOptions): Promise<PublicFormDefinition> {
  if (!options.formId.trim()) throw new Error('formId is required.');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error('A fetch implementation is required to load a Moreflow form.');

  const headers = new Headers(options.headers);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  const url = `${(options.baseUrl ?? '').replace(/\/$/u, '')}/api/v1/forms/${encodeURIComponent(options.formId)}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers,
      ...(options.signal ? { signal: options.signal } : {})
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new MoreflowFormError({
      message: 'The Moreflow form could not be loaded before a response was received.',
      retryable: true,
      cause: error
    });
  }

  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new MoreflowFormError({
      message:
        serverErrorMessage(body) ??
        `The Moreflow form could not be loaded (HTTP ${response.status}).`,
      status: response.status,
      code: serverErrorCode(body),
      retryable: retryableStatus(response.status),
      responseBody: body
    });
  }
  return normalizePublicFormDefinition(body, { formId: options.formId });
}

export interface PartitionedFormPages {
  /** Regular wizard pages in order. */
  steps: PublicFormRegularPage[];
  /** The thank-you page, when the form defines one. */
  thankYou: PublicFormThankYouPage | undefined;
}

export function partitionFormPages(definition: PublicFormDefinition): PartitionedFormPages {
  return {
    steps: definition.pages.filter((page) => page.type === 'regular'),
    thankYou: definition.pages.find((page) => page.type === 'thank_you')
  };
}

/** All input-collecting components across the form's regular pages. */
export function formInputComponents(definition: PublicFormDefinition): PublicFormComponent[] {
  return partitionFormPages(definition).steps.flatMap((page) =>
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
