import { z } from "zod";

/**
 * GUARD STAGE
 * Final validation gate. Builds a zod schema dynamically from the runtime
 * config (so it validates against whatever shape was actually requested,
 * not a hardcoded one), and checks the Shape stage's output against it.
 * On failure, degrades the offending field to null rather than throwing -
 * "a missing or garbage value must not crash the run."
 */

function zodTypeFor(typeStr) {
  switch (typeStr) {
    case "string":
      return z.string().nullable();
    case "string[]":
      return z.array(z.string()).nullable();
    case "number":
      return z.number().nullable();
    default:
      return z.any();
  }
}

/**
 * Builds a zod object schema from the config's field list.
 */
export function buildSchemaFromConfig(config) {
  const shape = {};
  for (const fieldConfig of config.fields) {
    shape[fieldConfig.path] = zodTypeFor(fieldConfig.type);
    if (config.include_confidence) {
      shape[`${fieldConfig.path}_confidence`] = z.number().nullable().optional();
    }
  }
  if (config.include_confidence) {
    shape.overall_confidence = z.number().optional();
  }
  return z.object(shape).passthrough(); // passthrough: don't reject extra keys
}

/**
 * Validates a single shaped record. On failure, nulls out the specific
 * invalid fields (identified from the zod error) rather than rejecting
 * the whole record outright - graceful degradation over hard failure.
 */
export function guardRecord(record, schema) {
  const result = schema.safeParse(record);

  if (result.success) {
    return { record: result.data, valid: true, errors: [] };
  }

  // Degrade: null out only the fields that failed validation.
  const degraded = { ...record };
  const errors = result.error.issues.map((issue) => {
    const fieldPath = issue.path.join(".");
    degraded[fieldPath] = null;
    return { field: fieldPath, message: issue.message };
  });

  return { record: degraded, valid: false, errors };
}

/**
 * Validates an array of shaped records against the requested schema.
 */
export function guardRecords(records, config) {
  const schema = buildSchemaFromConfig(config);
  const validated = [];
  const warnings = [];

  for (const record of records) {
    const { record: outRecord, valid, errors } = guardRecord(record, schema);
    validated.push(outRecord);
    if (!valid) {
      warnings.push({ message: "Record had validation issues, fields nulled", errors });
    }
  }

  return { validated, warnings };
}