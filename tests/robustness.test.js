import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, normalizeSkill, normalizeSkills } from "../src/standardize.js";
import { reconcile } from "../src/reconcile.js";
import { scoreCandidates } from "../src/score.js";

// --- standardize.js robustness ---

test("normalizePhone returns null for garbage input, never throws", () => {
  assert.equal(normalizePhone("abc"), null);
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone("12345"), null); // too short to be a real number
});

test("normalizePhone handles a valid number without country code", () => {
  assert.equal(normalizePhone("9876543210"), "+919876543210");
});

test("normalizeSkill keeps unrecognized skills as lowercase strings instead of dropping them", () => {
  assert.equal(normalizeSkill("Cloud Stuff"), "cloud stuff");
  assert.equal(normalizeSkill(""), null);
  assert.equal(normalizeSkill(null), null);
});

test("normalizeSkills dedupes synonyms and never throws on empty/garbage arrays", () => {
  assert.deepEqual(normalizeSkills(["node", "Node.js", "NODEJS"]), ["nodejs"]);
  assert.deepEqual(normalizeSkills([]), []);
  assert.deepEqual(normalizeSkills(null), []);
});

// --- reconcile.js / score.js robustness ---

test("reconcile does not crash on a fragment with no name and no email", () => {
  const fragments = [
    { source: "recruiter_notes", method: "regex_extraction", fullName: null, email: null, phone: null, skills: [] },
  ];
  const result = reconcile(fragments);
  // Should still produce exactly one candidate bucket, not throw.
  assert.equal(result.length, 1);
  assert.equal(result[0].fields.fullName.value, null);
});

test("reconcile does not crash on a completely empty fragment list", () => {
  const result = reconcile([]);
  assert.deepEqual(result, []);
});

test("score gives confidence 0 to an entirely empty candidate, not NaN or a crash", () => {
  const fragments = [
    { source: "recruiter_notes", method: "regex_extraction", fullName: null, email: null, phone: null, skills: [] },
  ];
  const reconciled = reconcile(fragments);
  const scored = scoreCandidates(reconciled);
  assert.equal(scored[0].overall_confidence, 0);
});

test("reconcile merges two fragments with same email even if names differ in casing", () => {
  const fragments = [
    { source: "recruiter_csv", method: "csv_row", fullName: "Test User", email: "TEST@EXAMPLE.COM", phone: "9876543210", skills: [] },
    { source: "recruiter_notes", method: "regex_extraction", fullName: "Test User", email: "test@example.com", phone: null, skills: ["python"] },
  ];
  const result = reconcile(fragments);
  assert.equal(result.length, 1); // should merge into ONE candidate, not two
});