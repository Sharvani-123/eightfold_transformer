/**
 * SCORE STAGE
 * Computes per-field and overall confidence for a reconciled candidate.
 * Deliberately separate from Reconcile: Reconcile decides WHAT the value is,
 * Score decides HOW SURE we are about it - confidence is a property of the
 * reconciliation outcome, not a raw input value.
 *
 * Rules:
 *  - No source provided the field -> confidence 0 (value is null anyway).
 *  - Multiple sources AGREED -> confidence 0.95 (corroborated).
 *  - Exactly one source provided it (uncorroborated) -> confidence 0.6.
 *  - Sources CONFLICTED and a tiebreak was applied -> confidence 0.4
 *    (we picked a winner, but real disagreement existed).
 */

function scoreField(fieldResult) {
  if (!fieldResult.value || (Array.isArray(fieldResult.value) && fieldResult.value.length === 0)) {
    return 0;
  }
  if (fieldResult.conflicted) return 0.4;
  if (fieldResult.agreement) return 0.95;
  return 0.6; // single uncorroborated source
}

/**
 * Adds a `confidence` number to each field, plus an `overall_confidence`
 * for the candidate (average across fields that were applicable).
 */
export function scoreCandidate(candidate) {
  const scoredFields = {};
  const confidences = [];

  for (const [fieldName, fieldResult] of Object.entries(candidate.fields)) {
    const confidence = scoreField(fieldResult);
    scoredFields[fieldName] = { ...fieldResult, confidence };
    confidences.push(confidence);
  }

  const overall_confidence =
    confidences.length > 0
      ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(2))
      : 0;

  return { ...candidate, fields: scoredFields, overall_confidence };
}

export function scoreCandidates(candidates) {
  return candidates.map(scoreCandidate);
}