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
    /**
     * @deprecated Moreflow no longer returns this client-field mapping hint; it is
     * undefined from current servers. Submissions are mapped server-side.
     */
    importAs?: string | undefined;
    size?: string | undefined;
    /**
     * The component as the server returned it, for render props the typed keys
     * do not cover (for example `content` of a heading or `src` of an image).
     */
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
    /**
     * The client-field mapping a legacy response carried; empty from current
     * Moreflow servers, which map every submission from the stored published
     * form and ignore a mapping sent with it. Sending it unchanged as
     * `input.fieldMatching` stays harmless.
     */
    fieldMatching: PublicFormFieldMatch[];
}
/** Component types that render content and never collect input. */
export declare const PRESENTATIONAL_COMPONENT_TYPES: ReadonlySet<string>;
export declare const PHONE_COMPONENT_TYPES: ReadonlySet<string>;
/**
 * Consent checkboxes. The privacy checkboxes acknowledge the privacy notice;
 * `tracking_consent` and `marketing_consent` grant consent (see
 * {@link DECLINABLE_CONSENT_COMPONENT_TYPES}). Each one blocks submission only
 * while the account marks it required and the visitor leaves it unticked.
 */
export declare const CONSENT_COMPONENT_TYPES: ReadonlySet<string>;
/**
 * Consent checkboxes that grant consent: never pre-ticked, and only a box the
 * visitor ticks grants anything, so an untouched box submits an explicit
 * `false`. They are optional unless the account marks them required.
 * `tracking_consent` grants email tracking consent; `marketing_consent` is the
 * only form field that grants marketing email consent.
 */
export declare const DECLINABLE_CONSENT_COMPONENT_TYPES: ReadonlySet<string>;
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
export declare function isComponentVisibleToVisitors(component: {
    type: string;
    checkboxText?: string | undefined;
}, options?: VisitorVisibilityOptions): boolean;
/**
 * Normalizes the public form response into one canonical
 * {@link PublicFormDefinition}.
 *
 * The clean v1 resource carries the form at the root (`id`, `name`,
 * `accountId`, `honeypotField`, `spamProtection`) and the published version as
 * `version`, with only what rendering needs: no client-field mapping, which
 * Moreflow applies server-side, so `fieldMatching` is empty. Older responses
 * carried a camelCase `fieldMatching`, and responses from before v1 a `record`
 * copy with `record.data.config.current_version`, a snake_case
 * `field_matching` alias and string options; those remain readable as a
 * fallback for embeds that still receive a legacy shape. Where both are
 * present, the v1 field wins. Prefers the candidate whose thank-you
 * page still carries its content props.
 */
export declare function normalizePublicFormDefinition(body: unknown, options?: {
    formId?: string | undefined;
}): PublicFormDefinition;
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
export declare function getPublicForm(options: GetPublicFormOptions): Promise<PublicFormDefinition>;
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
export declare function partitionFormPages(definition: PublicFormDefinition, options?: VisitorVisibilityOptions): PartitionedFormPages;
/**
 * The options with `companyName` defaulted to the definition's, so the
 * marketing box follows the server's brand name unless the caller names one.
 */
export declare function withDefinitionCompanyName<T extends VisitorVisibilityOptions>(definition: Pick<PublicFormDefinition, 'companyName'>, options: T): T;
/** All visible input-collecting components across the form's regular pages. */
export declare function formInputComponents(definition: PublicFormDefinition, options?: VisitorVisibilityOptions): PublicFormComponent[];
/**
 * Phone components that require SMS verification before submission. When this
 * is non-empty, run `sendPhoneVerification`/`checkPhoneVerification` for the
 * entered number and submit the verified E.164 value — the submission endpoint
 * does not enforce verification for you.
 */
export declare function phoneVerificationComponents(definition: PublicFormDefinition): PublicFormComponent[];
export declare function phoneVerificationRequired(definition: PublicFormDefinition): boolean;
export {};
