import type { PageExperimentAssignment } from './internal/page-experiments';
/**
 * The form experiment a hosted form render assigns the visitor to (docs/website-analytics.md §7.3).
 * The render response carries `experiment: { key, variant }`; this module keeps it in memory for the
 * page view, records the exposure through the served tracker when there is one, and merges it into
 * the submission's `experimentVariants`. Nothing is stored and nothing throws: a page without a
 * tracker, a server, or a broken tracker just gets no exposure.
 */
export type PublicFormExperiment = PageExperimentAssignment;
export declare function pageVisitorKey(): string | undefined;
export declare function rememberFormExperiment(formId: string, experiment: PublicFormExperiment | null | undefined): void;
export declare function formExperimentFor(formId: string): PublicFormExperiment | undefined;
/** Reads the render response's `experiment`; anything that is not `{ key, variant }` strings is no assignment. */
export declare function experimentFromRender(body: unknown): PublicFormExperiment | null;
/** Records the exposure through the served tracker, once per render. Guarded: never throws. */
export declare function trackExposure(experiment: PublicFormExperiment): void;
/** The form's assignment first, then the page's; one entry per experiment key (the first wins). */
export declare function mergeExperimentVariants(formAssignment: PublicFormExperiment | undefined, pageAssignments: readonly PublicFormExperiment[]): PublicFormExperiment[];
