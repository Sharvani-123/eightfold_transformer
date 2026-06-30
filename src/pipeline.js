import { ingest } from "./ingest.js";
import { parseCsv } from "./parse/parseCsv.js";
import { parseNotes } from "./parse/parseNotes.js";
import { standardizeFragments } from "./standardize.js";
import { reconcile } from "./reconcile.js";
import { scoreCandidates } from "./score.js";
import { shapeCandidates } from "./shape.js";
import { guardRecords } from "./guard.js";

/**
 * Routes a single ingested file to the correct parser based on its
 * detected source type.
 */
function parseBySourceType(ingestedFile) {
  const { sourceType, raw, filePath } = ingestedFile;

  if (sourceType === "recruiter_csv") {
    return parseCsv(raw, filePath);
  }
  if (sourceType === "recruiter_notes") {
    return parseNotes(raw, filePath);
  }
  return { fragments: [], warnings: [{ filePath, message: `No parser for source type: ${sourceType}` }] };
}

/**
 * Runs the full 7-stage pipeline end-to-end:
 * Ingest -> Parse -> Standardize -> Reconcile -> Score -> Shape -> Guard
 *
 * @param {string[]} filePaths - paths to source files (CSV, .txt, etc.)
 * @param {object|null} config - runtime output config; if null, a permissive
 *        default config (all canonical fields, confidence included) is used.
 * @returns {{ output: object[], warnings: object[] }}
 */
export function runPipeline(filePaths, config = null) {
  const allWarnings = [];

  // --- Ingest ---
  const { ingested, warnings: ingestWarnings } = ingestAllSafe(filePaths);
  allWarnings.push(...ingestWarnings);

  // --- Parse ---
  const allFragments = [];
  for (const file of ingested) {
    const { fragments, warnings } = parseBySourceType(file);
    allFragments.push(...fragments);
    allWarnings.push(...warnings);
  }

  // --- Standardize ---
  const standardized = standardizeFragments(allFragments);

  // --- Reconcile ---
  const reconciled = reconcile(standardized);

  // --- Score ---
  const scored = scoreCandidates(reconciled);

  // --- Shape ---
  const effectiveConfig = config ?? defaultConfig();
  const { results: shaped, warnings: shapeWarnings } = shapeCandidates(scored, effectiveConfig);
  allWarnings.push(...shapeWarnings);

  // --- Guard ---
  const { validated, warnings: guardWarnings } = guardRecords(shaped, effectiveConfig);
  allWarnings.push(...guardWarnings);

  return { output: validated, warnings: allWarnings };
}

// Re-implemented here to avoid a circular import; thin wrapper around ingest().
function ingestAllSafe(filePaths) {
  const ingested = [];
  const warnings = [];
  for (const fp of filePaths) {
    try {
      ingested.push(ingest(fp));
    } catch (err) {
      warnings.push({ filePath: fp, message: err.message });
    }
  }
  return { ingested, warnings };
}

/**
 * Default config used when no --config flag is passed: includes every
 * canonical field, with provenance/confidence on, nothing required
 * (so a partial profile still comes through rather than being dropped).
 */
function defaultConfig() {
  return {
    fields: [
      { path: "full_name", from: "fullName", type: "string" },
      { path: "emails", from: "email", type: "string" },
      { path: "phones", from: "phone", type: "string" },
      { path: "company", from: "company", type: "string" },
      { path: "title", from: "title", type: "string" },
      { path: "skills", from: "skills", type: "string[]" },
    ],
    include_confidence: true,
    on_missing: "null",
  };
}