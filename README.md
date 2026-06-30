# Multi-Source Candidate Data Transformer

**Author:** Sharvani (sharvani11620@gmail.com)
**Assignment:** Eightfold Engineering Intern (Jul-Dec 2026)

A pipeline that ingests candidate data from a structured source (recruiter CSV export)
and an unstructured source (recruiter notes, free text), merges them into one canonical
profile per candidate, and projects the result into a configurable output shape.

## Pipeline

```
Ingest → Parse → Standardize → Reconcile → Score → Shape → Guard
```

- **Ingest** — detects file type from extension, reads the raw file. Missing/unreadable/
  empty files are caught here as warnings, not crashes.
- **Parse** — converts each source's native format into a common raw-fragment shape.
  CSV rows are parsed directly; recruiter notes use pattern matching (regex/keyword
  scanning) to pull out email, phone, and mentioned skills from free text.
- **Standardize** — applies normalization uniformly regardless of source: phone numbers
  to E.164, emails lowercased, skills collapsed to canonical names via a synonym map.
- **Reconcile** — groups fragments belonging to the same candidate (matched by lowercased
  email, with a name-based fallback when email is missing from every source), and
  resolves field-level conflicts. Names use a completeness-based rule (the fuller string
  wins); contact info uses a justified source-priority rule (CSV is treated as more
  reliable for contact info since it's entered into a structured system, not transcribed
  by hand); skills are merged as a union since they're additive, not conflicting.
- **Score** — a separate confidence pass over the reconciled record. Confidence reflects
  trust in the *merge outcome*, not a raw input value: agreement across sources scores
  highest, a single uncorroborated source scores moderate, a resolved conflict scores
  lower, and a field with no source at all scores 0.
- **Shape** — a config-driven projector that reshapes the canonical record into the
  requested output (field subset, renames, provenance/confidence toggle), without
  mutating the canonical record itself.
- **Guard** — validates the shaped output against a schema (zod) built dynamically from
  the same config, before anything is returned.

## How to Run

Install dependencies:
```bash
npm install
```

Run with the default schema (uses sample files in `samples/` by default):
```bash
node cli.js
```

Run with a custom output config:
```bash
node cli.js --config config/sample-config.json
```

Run against specific files and write output to a file:
```bash
node cli.js --inputs samples/recruiter_export.csv,samples/recruiter_notes.txt --config config/sample-config.json --out output/result.json
```

Run tests:
```bash
npm test
```

## Demo Scripts

`demo-scripts/` contains two standalone scripts (separate from the formal unit tests in
`tests/`) used to visually inspect the pipeline's intermediate output, stage by stage:

- `demo-scripts/full-pipeline-walkthrough.js` — runs the clean sample data
  (`samples/recruiter_export.csv` + `samples/recruiter_notes.txt`) through every stage
  in sequence (Parse → Standardize → Reconcile → Score), logging the output at each step.
- `demo-scripts/edge-case-walkthrough.js` — runs the adversarial sample
  (`samples/recruiter_notes_edge.txt`) through Parse and Standardize, to show how
  malformed/unidentifiable input degrades gracefully instead of crashing.

Run either from the project root:
```bash
node demo-scripts/full-pipeline-walkthrough.js
node demo-scripts/edge-case-walkthrough.js
```

## Canonical Schema & Formats

- Phones: E.164 (e.g. `+919876543210`)
- Emails: lowercased
- Skills: canonical lowercase strings via a fixed synonym map
- Each field carries `value`, `provenance` (which source(s) contributed it and how),
  and `confidence`

## Sample Data

- `samples/recruiter_export.csv` — structured source. Includes a row with a missing
  email (tests the name-fallback merge) and a row with a malformed phone number (tests
  graceful null-degrade instead of a crash).
- `samples/recruiter_notes.txt` — unstructured source. Free-text blurbs for the same
  candidates, written in a natural, inconsistent style.
- `samples/recruiter_notes_edge.txt` — a deliberately adversarial notes file used to
  stress-test the Parse stage: a block with no identifiable name or email, an
  all-lowercase name with an uppercase email, a hyphenated/apostrophe name format the
  extractor doesn't support, an implausibly short "phone" number, stray HTML, and a
  blank block.

## Tests

`tests/robustness.test.js` runs unit tests directly against `standardize.js`,
`reconcile.js`, and `score.js` using garbage, empty, and edge-case input — independent
of the sample files — to confirm the core engine doesn't crash regardless of what Parse
hands it.

## Known Limitations & Scope Cuts

- **Skill canonicalization is dictionary-based, not fuzzy/semantic.** An abbreviation or
  typo not present in the synonym map (e.g. an unlisted shorthand) is kept as a
  lowercase string rather than dropped or guessed at — no data is silently lost, but it
  also won't be merged with its canonical form. A production version would use a larger
  taxonomy or embedding-based matching.
- **Free-text name/skill extraction is pattern-based and best-effort, not guaranteed
  correct.** It is designed to fail safely: when a notes block has no identifiable name
  or email, it is skipped entirely (including any skills mentioned in it) rather than
  guessing at an identity. This is demonstrated in `samples/recruiter_notes_edge.txt`.
- **Config field remapping (`from`) maps directly to a canonical field name** (e.g.
  `fullName`, `email`), not full JSONPath-style array indexing. Supporting arbitrary
  path expressions was descoped given time constraints.
- **Sources covered:** recruiter CSV export (structured) and recruiter notes (unstructured)
  only. PDF/DOCX resume parsing, live GitHub/LinkedIn API calls, and fuzzy/nickname
  name-matching were deliberately left out of scope.
- **No UI** beyond the CLI — a CLI is explicitly stated as sufficient in the assignment.

## Assumptions

- Phone numbers without an explicit country code are assumed to be Indian numbers
  (default region `IN`), matching the sample data.
- Email is treated as the most reliable identity key across sources; name-based matching
  is only used as a fallback when email is unavailable from every source for a candidate.
