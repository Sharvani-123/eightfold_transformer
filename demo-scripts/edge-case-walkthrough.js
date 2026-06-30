import { ingest } from "./src/ingest.js";
import { parseNotes } from "./src/parse/parseNotes.js";
import { standardizeFragments } from "./src/standardize.js";
import { reconcile } from "./src/reconcile.js";
import { scoreCandidates } from "./src/score.js";

const edgeResult = ingest("samples/recruiter_notes_edge.txt");
const { fragments, warnings } = parseNotes(edgeResult.raw, edgeResult.filePath);

console.log("=== Edge Case Fragments ===");
console.log(JSON.stringify(fragments, null, 2));
console.log("=== Edge Case Warnings ===");
console.log(warnings);

const standardized = standardizeFragments(fragments);
console.log("\n=== Edge Case Standardized ===");
console.log(JSON.stringify(standardized, null, 2));

const reconciled = reconcile(standardized);
const scored = scoreCandidates(reconciled);

console.log("\n=== Reconciled + Scored Candidates ===");
console.log(JSON.stringify(scored, null, 2));