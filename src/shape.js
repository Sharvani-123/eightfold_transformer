/**
 * SHAPE STAGE
 * Takes a reconciled+scored canonical candidate and projects it into
 * the output shape requested by the runtime config. This is the ONLY
 * stage that knows about the config - the canonical record itself is
 * never mutated, keeping "internal record" and "requested output shape"
 * cleanly separated per the assignment's requirement.
 *
 * Config shape (see config/sample-config.json):
 * {
 *   "fields": [
 *     { "path": "full_name", "from": "fullName", "type": "string", "required": true },
 *     { "path": "primary_email", "from": "email", "type": "string", "required": true },
 *     { "path": "phone", "from": "phone", "type": "string" },
 *     { "path": "skills", "from": "skills", "type": "string[]" }
 *   ],
 *   "include_confidence": true,
 *   "on_missing": "null" | "omit" | "error"
 * }
 *
 * "from" maps to a key inside candidate.fields (our canonical field names:
 * fullName, email, phone, company, title, skills). If "from" is omitted,
 * we assume "path" itself is the canonical field name.
 */

class MissingRequiredFieldError extends Error {
  constructor(fieldPath) {
    super(`Required field "${fieldPath}" is missing`);
    this.name = "MissingRequiredFieldError";
    this.fieldPath = fieldPath;
  }
}

function getCanonicalFieldName(fieldConfig) {
  return fieldConfig.from ?? fieldConfig.path;
}

/**
 * Projects a single candidate according to the config.
 * Throws MissingRequiredFieldError if on_missing is "error" and a
 * required field has no value - caught by the caller (Guard/pipeline)
 * so one bad candidate doesn't kill the whole batch.
 */
export function shapeCandidate(candidate, config) {
  const onMissing = config.on_missing ?? "null";
  const includeConfidence = config.include_confidence ?? false;
  const output = {};

  for (const fieldConfig of config.fields) {
    const canonicalName = getCanonicalFieldName(fieldConfig);
    const fieldResult = candidate.fields[canonicalName];

    const isEmpty =
      !fieldResult ||
      fieldResult.value === null ||
      fieldResult.value === undefined ||
      (Array.isArray(fieldResult.value) && fieldResult.value.length === 0);

    if (isEmpty) {
      if (fieldConfig.required && onMissing === "error") {
        throw new MissingRequiredFieldError(fieldConfig.path);
      }
      if (onMissing === "omit") {
        continue; // skip adding this key entirely
      }
      // default: "null"
      output[fieldConfig.path] = null;
      continue;
    }

    output[fieldConfig.path] = fieldResult.value;

    if (includeConfidence) {
      output[`${fieldConfig.path}_confidence`] = fieldResult.confidence;
    }
  }

  if (includeConfidence && config.fields.length > 0) {
    output.overall_confidence = candidate.overall_confidence;
  }

  return output;
}

/**
 * Projects an array of candidates. A candidate that fails required-field
 * validation (on_missing: "error") is excluded from output and reported
 * as a warning, rather than crashing the whole batch.
 */
export function shapeCandidates(candidates, config) {
  const results = [];
  const warnings = [];

  for (const candidate of candidates) {
    try {
      results.push(shapeCandidate(candidate, config));
    } catch (err) {
      if (err instanceof MissingRequiredFieldError) {
        warnings.push({
          message: `Candidate excluded from output: ${err.message}`,
          candidateEmail: candidate.fields?.email?.value ?? "unknown",
        });
      } else {
        throw err;
      }
    }
  }

  return { results, warnings };
}