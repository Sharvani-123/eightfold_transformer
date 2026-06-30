/**
 * RECONCILE STAGE
 * Groups standardized fragments into one canonical record per candidate,
 * and resolves field-level conflicts.
 *
 * Identity matching:
 *  - Primary: lowercased email (most reliable unique identifier we have).
 *  - Fallback: "first name + first letter of last name" key, used only
 *    for fragments missing an email entirely (e.g. Rohan, whose email
 *    is absent in both sources). This is deterministic and explainable -
 *    not fuzzy/ML matching - by design, per the assignment's
 *    "deterministic & explainable" constraint.
 *
 * Conflict resolution (per field, justified individually - not a single
 * blanket "source X always wins" rule):
 *  - email / phone -> PRIORITY strategy: recruiter_csv wins over
 *    recruiter_notes on ties, because it's entered into a structured
 *    contact-tracking system rather than transcribed by hand during/after
 *    a call. If both sources actually agree, that's used directly
 *    (no tiebreak needed).
 *  - fullName -> COMPLETENESS strategy: the longer/more complete string
 *    wins (e.g. "Rohan Verma" beats "Rohan V"), since this is a
 *    source-agnostic, content-based rule rather than picking by source.
 *    Falls back to the same priority order only if both values are
 *    equally complete.
 *  - skills -> UNION: skills aren't really "conflicting" between sources,
 *    they're additive - we merge and dedupe across both sources instead
 *    of picking a winner.
 *  - company / title -> currently CSV-only fields in our scope, so no
 *    conflict exists; kept as-is.
 */

const SOURCE_PRIORITY = ["recruiter_csv", "recruiter_notes"];

function normalizeNameKey(fullName) {
  if (!fullName) return null;
  const cleaned = fullName.replace(/[.,]+$/, "").trim().toLowerCase();
  const tokens = cleaned.split(/\s+/);
  if (tokens.length === 0) return null;
  const first = tokens[0];
  const lastInitial = tokens.length > 1 ? tokens[tokens.length - 1][0] : "";
  return `${first} ${lastInitial}`.trim();
}

/**
 * Groups fragments into candidate buckets by identity.
 */
function groupFragments(fragments) {
  const byEmail = new Map(); // email -> bucket
  const byNameKey = new Map(); // nameKey -> bucket
  const buckets = [];

  // Pass 1: fragments WITH an email - group directly by email.
  for (const frag of fragments) {
    if (!frag.email) continue;
    const key = frag.email.toLowerCase();
    if (!byEmail.has(key)) {
      const bucket = { fragments: [], emailKey: key, nameKey: normalizeNameKey(frag.fullName) };
      byEmail.set(key, bucket);
      buckets.push(bucket);
    }
    byEmail.get(key).fragments.push(frag);
  }

  // Index existing buckets by nameKey too, so no-email fragments can find them.
  for (const bucket of buckets) {
    if (bucket.nameKey) byNameKey.set(bucket.nameKey, bucket);
  }

  // Pass 2: fragments WITHOUT an email - fall back to name-key matching.
  for (const frag of fragments) {
    if (frag.email) continue; // already handled above
    const nameKey = normalizeNameKey(frag.fullName);

    if (nameKey && byNameKey.has(nameKey)) {
      byNameKey.get(nameKey).fragments.push(frag);
      continue;
    }

    // No existing bucket matches - create a new one keyed by name.
    const bucket = { fragments: [frag], emailKey: null, nameKey };
    buckets.push(bucket);
    if (nameKey) byNameKey.set(nameKey, bucket);
  }

  return buckets;
}

/**
 * Resolves a scalar field across fragments using either a PRIORITY
 * or COMPLETENESS strategy. Returns { value, provenance, agreement, conflicted }.
 */
function resolveScalarField(fragments, fieldName, strategy) {
  const entries = fragments
    .filter((f) => f[fieldName])
    .map((f) => ({ value: f[fieldName], source: f.source, method: f.method }));

  if (entries.length === 0) {
    return { value: null, provenance: [], agreement: false, conflicted: false };
  }

  const distinctValues = new Set(entries.map((e) => e.value.toLowerCase()));

  if (distinctValues.size === 1) {
    // All sources agree (or only one source provided it).
    return {
      value: entries[0].value,
      provenance: entries.map((e) => ({ source: e.source, method: e.method })),
      agreement: entries.length > 1,
      conflicted: false,
    };
  }

  // Genuine conflict - apply the field's strategy.
  let winner;
  if (strategy === "completeness") {
    winner = entries.reduce((longest, current) =>
      current.value.length > longest.value.length ? current : longest
    , entries[0]);
    // Tie in length -> fall back to source priority.
    const sameLengthTies = entries.filter((e) => e.value.length === winner.value.length);
    if (sameLengthTies.length > 1) {
      winner = sameLengthTies.sort(
        (a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source)
      )[0];
    }
  } else {
    // priority strategy
    winner = [...entries].sort(
      (a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source)
    )[0];
  }

  return {
    value: winner.value,
    provenance: entries.map((e) => ({ source: e.source, method: e.method })),
    agreement: false,
    conflicted: true,
  };
}

/**
 * Merges skills across fragments as a union (not a winner-takes-all field).
 */
function resolveSkillsField(fragments) {
  const allSkills = fragments.flatMap((f) => f.skills || []);
  const unique = Array.from(new Set(allSkills));
  const sourcesUsed = Array.from(
    new Set(fragments.filter((f) => f.skills && f.skills.length > 0).map((f) => f.source))
  );

  return {
    value: unique,
    provenance: sourcesUsed.map((source) => ({ source, method: "merged_union" })),
    agreement: sourcesUsed.length > 1,
    conflicted: false, // skills don't conflict, they accumulate
  };
}

/**
 * Reconciles all fragments into an array of canonical candidate records.
 */
export function reconcile(fragments) {
  const buckets = groupFragments(fragments);

  return buckets.map((bucket) => {
    const frags = bucket.fragments;

    const fullName = resolveScalarField(frags, "fullName", "completeness");
    const email = resolveScalarField(frags, "email", "priority");
    const phone = resolveScalarField(frags, "phone", "priority");
    const company = resolveScalarField(frags, "company", "priority");
    const title = resolveScalarField(frags, "title", "priority");
    const skills = resolveSkillsField(frags);

    return {
      fields: { fullName, email, phone, company, title, skills },
      sourceCount: new Set(frags.map((f) => f.source)).size,
      rawFragmentCount: frags.length,
    };
  });
}