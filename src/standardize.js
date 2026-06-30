import { parsePhoneNumberFromString } from "libphonenumber-js";

// Synonym map: many written forms -> one canonical skill name.
// NOTE (known limitation, stated deliberately): this is a fixed dictionary,
// not fuzzy/semantic matching. An abbreviation or variant not listed here
// will be kept as a lowercase string rather than dropped or guessed at -
// so no information is silently lost, but it also won't be merged into its
// canonical form. See README "Limitations" for the production-scale fix.
const SKILL_CANONICAL_MAP = {
  // JavaScript / Node ecosystem
  "javascript": "javascript",
  "js": "javascript",
  "node.js": "nodejs",
  "nodejs": "nodejs",
  "node": "nodejs",
  "express": "expressjs",
  "expressjs": "expressjs",
  "express.js": "expressjs",

  // TypeScript
  "typescript": "typescript",
  "ts": "typescript",

  // React
  "react": "react",
  "reactjs": "react",
  "react.js": "react",

  // Databases
  "mongodb": "mongodb",
  "mongo": "mongodb",
  "mongo db": "mongodb",
  "postgresql": "postgresql",
  "postgres": "postgresql",
  "pg": "postgresql",
  "mysql": "mysql",
  "my sql": "mysql",

  // Infra / DevOps
  "docker": "docker",
  "kubernetes": "kubernetes",
  "k8s": "kubernetes",
  "aws": "aws",
  "amazon web services": "aws",

  // Backend frameworks / languages
  "java": "java",
  "spring boot": "spring-boot",
  "spring": "spring-boot",
  "springboot": "spring-boot",
  "kafka": "kafka",
  "python": "python",
  "django": "django",
  "flask": "flask",

  // API styles
  "graphql": "graphql",
  "rest": "rest",
  "restful": "rest",
  "socket.io": "socketio",
  "socketio": "socketio",
};

/**
 * Normalizes a phone number to E.164 format (e.g. +919876543210).
 * Defaults to India ("IN") as the assumed country when no country code
 * is present, since our sample data is India-based recruiter exports.
 * Returns null (never throws) if the number is malformed/unparseable -
 * this is the "garbage source must not crash the run" requirement in action.
 */
export function normalizePhone(rawPhone, defaultCountry = "IN") {
  if (!rawPhone) return null;

  try {
    const phoneNumber = parsePhoneNumberFromString(rawPhone, defaultCountry);
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format("E.164");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Collapses any written form of a skill to its canonical name.
 * Unrecognized skills are kept as-is (lowercased) rather than dropped,
 * so we don't silently lose information the schema didn't anticipate.
 *
 * LIMITATION: matching is dictionary-based, not fuzzy/semantic. A variant
 * not present in SKILL_CANONICAL_MAP (e.g. an unlisted abbreviation or typo)
 * will not be merged with its canonical form.
 */
export function normalizeSkill(rawSkill) {
  if (!rawSkill) return null;
  const lower = rawSkill.trim().toLowerCase();
  return SKILL_CANONICAL_MAP[lower] ?? lower;
}

/**
 * Normalizes an array of raw skill strings into a deduplicated
 * array of canonical skill names.
 */
export function normalizeSkills(rawSkills) {
  if (!rawSkills || rawSkills.length === 0) return [];
  const canonical = rawSkills.map(normalizeSkill).filter(Boolean);
  return Array.from(new Set(canonical));
}

/**
 * Normalizes a free-text date-ish string to YYYY-MM.
 * Not used by our current sample sources (no dates in CSV/notes),
 * but included since experience/education entries in the full schema need it.
 * Returns null if the string can't be confidently parsed.
 */
export function normalizeDateToYearMonth(rawDate) {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Applies standardization to a single raw fragment (from Parse stage),
 * returning a new fragment with normalized fields. Original raw fields
 * are not mutated - this keeps Parse output available for debugging/provenance.
 */
export function standardizeFragment(fragment) {
  return {
    ...fragment,
    phone: normalizePhone(fragment.phone),
    skills: normalizeSkills(fragment.skills),
  };
}

export function standardizeFragments(fragments) {
  return fragments.map(standardizeFragment);
}