import { ingest } from "./src/ingest.js";
import { parseCsv } from "./src/parse/parseCsv.js";
import { parseNotes } from "./src/parse/parseNotes.js";
import { standardizeFragments } from "./src/standardize.js";
import { reconcile } from "./src/reconcile.js";
import { scoreCandidates } from "./src/score.js";

const csvResult = ingest("samples/recruiter_export.csv");
const { fragments: csvFragments, warnings: csvWarnings } = parseCsv(
  csvResult.raw,
  csvResult.filePath
);

console.log("=== CSV Fragments ===");
console.log(JSON.stringify(csvFragments, null, 2));
console.log("=== CSV Warnings ===");
console.log(csvWarnings);

const notesResult = ingest("samples/recruiter_notes.txt");
const { fragments: notesFragments, warnings: notesWarnings } = parseNotes(
  notesResult.raw,
  notesResult.filePath
);

console.log("\n=== Notes Fragments ===");
console.log(JSON.stringify(notesFragments, null, 2));
console.log("=== Notes Warnings ===");
console.log(notesWarnings);



// ... after getting csvFragments and notesFragments ...
const allFragments = [...csvFragments, ...notesFragments];
const standardized = standardizeFragments(allFragments);

console.log("\n=== Standardized Fragments ===");
console.log(JSON.stringify(standardized, null, 2));



const reconciled = reconcile(standardized);
const scored = scoreCandidates(reconciled);

console.log("\n=== Reconciled + Scored Candidates ===");
console.log(JSON.stringify(scored, null, 2));