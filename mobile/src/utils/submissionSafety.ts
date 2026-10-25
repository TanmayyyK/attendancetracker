/**
 * Submission Safety & Error Classification Policy
 *
 * Implements client-side timeout safety and error classification for attendance submissions:
 * 1. Categorizes outcomes into 'success', 'definite_rejection', and 'ambiguous_failure'.
 * 2. Formulates deterministic, loss-free payload signatures for duplicate prevention warnings.
 * 3. Provides a stateful SubmissionSafetyController to coordinate confirmation flow and recovery.
 *
 * Zero external runtime dependencies; 100% testable in Node.
 */

export const DEFAULT_SUBMISSION_TIMEOUT_MS = 15000;

export type AmbiguousFailureReason =
  | 'client_timeout'
  | 'transport_error'
  | 'gateway_timeout'
  | 'server_error'
  | 'malformed_response';

export type SuccessOutcome = { kind: 'success'; inserted: number };

export type DefiniteRejectionOutcome = {
  kind: 'definite_rejection';
  error: string;
  statusCode: number;
};

export type AmbiguousFailureOutcome = {
  kind: 'ambiguous_failure';
  error: string;
  reason: AmbiguousFailureReason;
  statusCode?: number;
};

export type SubmissionFailureOutcome = DefiniteRejectionOutcome | AmbiguousFailureOutcome;

export type SubmissionOutcome = SuccessOutcome | SubmissionFailureOutcome;

export interface AttendanceSubmissionRow {
  date: string;
  mode: string;
  subject: string;
  present: number;
  absent: number;
  absent_reasons?: string[];
}

/**
 * Computes a deterministic, loss-free canonical signature of an attendance batch payload.
 * Sensitive to date, subject names, present/absent counts, and absent reasons.
 */
export function computeSubmissionSignature(
  date: string,
  rows: AttendanceSubmissionRow[]
): string {
  const canonicalRows = [...rows]
    .map((r) => ({
      subject: r.subject.trim(),
      present: r.present,
      absent: r.absent,
      absent_reasons: [...(r.absent_reasons || [])].sort(),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return JSON.stringify({
    date: date.trim(),
    rows: canonicalRows,
  });
}

/**
 * Classifies an HTTP status code and optional error detail into a structured failure outcome.
 */
export function classifyHttpOutcome(
  status: number,
  detailMessage?: string
): SubmissionFailureOutcome {
  // 4xx errors: Server explicitly validated and rejected before database transaction
  if (status >= 400 && status < 500) {
    const errorMsg = detailMessage || `Request was rejected by server (${status}).`;
    return {
      kind: 'definite_rejection',
      error: errorMsg,
      statusCode: status,
    };
  }

  // 502, 503, 504: Gateway/proxy timeout or unavailable
  // Vercel or gateway dropped connection; backend transaction may have committed
  if (status === 502 || status === 503 || status === 504) {
    const errorMsg = `Server response timed out (${status}). The server may have processed your request.`;
    return {
      kind: 'ambiguous_failure',
      error: errorMsg,
      reason: 'gateway_timeout',
      statusCode: status,
    };
  }

  // 500: Server internal error (may have occurred during/around transaction commit)
  if (status === 500) {
    const errorMsg = detailMessage || `Server error (500). Your attendance status is unconfirmed.`;
    return {
      kind: 'ambiguous_failure',
      error: errorMsg,
      reason: 'server_error',
      statusCode: status,
    };
  }

  // Any other non-2xx status
  return {
    kind: 'ambiguous_failure',
    error: detailMessage || `Unexpected server status (${status}).`,
    reason: 'server_error',
    statusCode: status,
  };
}

/**
 * Classifies caught fetch exceptions (e.g. AbortError, TypeError: Network request failed).
 */
export function classifyCaughtException(
  err: any,
  wasAborted: boolean
): AmbiguousFailureOutcome {
  if (wasAborted || err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('aborted')) {
    return {
      kind: 'ambiguous_failure',
      error: 'Request timed out after 15 seconds. The server may still be processing your submission.',
      reason: 'client_timeout',
    };
  }

  return {
    kind: 'ambiguous_failure',
    error: err?.message || 'Network connection was interrupted. The server may have received your submission.',
    reason: 'transport_error',
  };
}

export interface SubmissionSafetyState {
  lastAmbiguousSignature: string | null;
  formResetCount: number;
  invalidationTriggeredCount: number;
}

/**
 * Pure stateful controller that coordinates the submission safety lifecycle:
 * - Checks if confirmation is required for identical retries.
 * - Handles outcomes (success, definite rejection, ambiguous failure).
 * - Manages invalidation and form state triggers.
 */
export class SubmissionSafetyController {
  private lastAmbiguousSignature: string | null = null;

  /**
   * Evaluates if an identical payload was previously flagged as ambiguous.
   */
  shouldPromptConfirmation(signature: string): boolean {
    return this.lastAmbiguousSignature !== null && this.lastAmbiguousSignature === signature;
  }

  /**
   * Returns current active ambiguous signature, if any.
   */
  getLastAmbiguousSignature(): string | null {
    return this.lastAmbiguousSignature;
  }

  /**
   * Processes a submission outcome and updates internal tracking.
   */
  handleOutcome(
    signature: string,
    outcome: SubmissionOutcome,
    callbacks: {
      onSuccess: () => void;
      onDefiniteRejection: (error: string) => void;
      onAmbiguousFailure: (error: string, reason: AmbiguousFailureReason) => void;
    }
  ): void {
    if (outcome.kind === 'success') {
      this.lastAmbiguousSignature = null;
      callbacks.onSuccess();
    } else if (outcome.kind === 'definite_rejection') {
      // Definite rejection: server did not commit, so user is free to retry without duplicate warning
      this.lastAmbiguousSignature = null;
      callbacks.onDefiniteRejection(outcome.error);
    } else {
      // Ambiguous failure: record signature so identical resubmission prompts confirmation
      this.lastAmbiguousSignature = signature;
      callbacks.onAmbiguousFailure(outcome.error, outcome.reason);
    }
  }

  /**
   * Clears any stored ambiguous signature (e.g. when user changes form or leaves screen).
   */
  clear(): void {
    this.lastAmbiguousSignature = null;
  }
}
