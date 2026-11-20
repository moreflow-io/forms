import type { PageExperimentAssignment } from './internal/page-experiments';

/**
 * The form experiment a hosted form render assigns the visitor to (docs/website-analytics.md §7.3).
 * The render response carries `experiment: { key, variant }`; this module keeps it in memory for the
 * page view, records the exposure through the served tracker when there is one, and merges it into
 * the submission's `experimentVariants`. Nothing is stored and nothing throws: a page without a
 * tracker, a server, or a broken tracker just gets no exposure.
 */

export type PublicFormExperiment = PageExperimentAssignment;

/** The page view's visitor key: random, kept in memory only, never stored. Undefined on a server. */
let pageVisitorKeyValue: string | undefined;
export function pageVisitorKey(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  if (pageVisitorKeyValue === undefined) pageVisitorKeyValue = randomKey();
  return pageVisitorKeyValue;
}

function randomKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** The assignment of each rendered form, by form id, for the submission of that form. */
const assignmentsByForm = new Map<string, PublicFormExperiment>();

export function rememberFormExperiment(formId: string, experiment: PublicFormExperiment | null | undefined): void {
  if (experiment) assignmentsByForm.set(formId, { experiment: experiment.experiment, variant: experiment.variant });
  else assignmentsByForm.delete(formId);
}

export function formExperimentFor(formId: string): PublicFormExperiment | undefined {
  return assignmentsByForm.get(formId);
}

/** Reads the render response's `experiment`; anything that is not `{ key, variant }` strings is no assignment. */
export function experimentFromRender(body: unknown): PublicFormExperiment | null {
  if (typeof body !== 'object' || body === null || !('experiment' in body)) return null;
  const experiment = (body as { experiment: unknown }).experiment;
  if (typeof experiment !== 'object' || experiment === null) return null;
  const record = experiment as { key?: unknown; variant?: unknown };
  return typeof record.key === 'string' && typeof record.variant === 'string' ? { experiment: record.key, variant: record.variant } : null;
}

/** Records the exposure through the served tracker, once per render. Guarded: never throws. */
export function trackExposure(experiment: PublicFormExperiment): void {
  try {
    if (typeof window === 'undefined') return;
    const tracker = (window as unknown as { moreflowAnalytics?: { track?: unknown } }).moreflowAnalytics;
    const track = tracker?.track;
    if (typeof track !== 'function') return;
    track.call(tracker, 'exposure', { experiment: experiment.experiment, variant: experiment.variant });
  } catch {
    // An exposure is analytics; a failing tracker must not break the form.
  }
}

/** The form's assignment first, then the page's; one entry per experiment key (the first wins). */
export function mergeExperimentVariants(
  formAssignment: PublicFormExperiment | undefined,
  pageAssignments: readonly PublicFormExperiment[]
): PublicFormExperiment[] {
  const seen = new Set<string>();
  const merged: PublicFormExperiment[] = [];
  for (const entry of formAssignment ? [formAssignment, ...pageAssignments] : pageAssignments) {
    if (seen.has(entry.experiment)) continue;
    seen.add(entry.experiment);
    merged.push(entry);
  }
  return merged;
}
