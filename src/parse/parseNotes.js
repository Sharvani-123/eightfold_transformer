/**
 * Parses free-text recruiter notes into raw fragments using
 * regex/keyword extraction. Notes are split into blocks by "---" or blank lines.
 */


// Known skill keywords to scan for - extend as needed
const KNOWN_SKILLS = [
  "node.js", "nodejs", "node", "express", "expressjs", "mongodb", "mongo",
  "react", "reactjs", "typescript", "javascript", "postgresql", "postgres",
  "docker", "kubernetes", "java", "spring boot", "spring", "kafka", "aws",
  "python", "django", "flask", "graphql", "rest", "socket.io",
];

const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})*/;
const PHONE_REGEX = /(\+?\d[\d\s-]{8,14}\d)/;

// Matches exactly two capitalized tokens, e.g. "Aarav Mehta", "Rohan V."
const NAME_PATTERN = "[A-Z][a-zA-Z]*\\.?\\s[A-Z][a-zA-Z]*\\.?";

function cleanName(s) {
  return s.replace(/[.,]+$/, "").trim();
}

function extractName(block) {
  const candidateMatch = block.match(new RegExp(`Candidate:\\s*(${NAME_PATTERN})`));
  if (candidateMatch) return cleanName(candidateMatch[1]);

  const withMatch = block.match(new RegExp(`with\\s+(${NAME_PATTERN})`));
  if (withMatch) return cleanName(withMatch[1]);

  const namedMatch = block.match(new RegExp(`named\\s+(${NAME_PATTERN})`));
  if (namedMatch) return cleanName(namedMatch[1]);

  const noteOnMatch = block.match(new RegExp(`note on\\s+(${NAME_PATTERN})`, "i"));
  if (noteOnMatch) return cleanName(noteOnMatch[1]);

  return null;
}

function extractSkills(block) {
  const lowerBlock = block.toLowerCase();
  const found = new Set();
  for (const skill of KNOWN_SKILLS) {
    if (lowerBlock.includes(skill)) {
      found.add(skill);
    }
  }
  return Array.from(found);
}

export function parseNotes(raw, filePath) {
  const blocks = raw
  .split(/\r?\n---+\r?\n/)
  .map((b) => b.trim())
  .filter((b) => b.length > 0);

  const fragments = [];
  const warnings = [];

  blocks.forEach((block, idx) => {
    const emailMatch = block.match(EMAIL_REGEX);
    const phoneMatch = block.match(PHONE_REGEX);
    const name = extractName(block);
    const skills = extractSkills(block);

    if (!name && !emailMatch) {
      warnings.push({
        filePath,
        message: `Notes block ${idx + 1} has no identifiable name or email - skipped`,
      });
      return;
    }

    fragments.push({
      source: "recruiter_notes",
      method: "regex_extraction",
      rawIndex: idx,
      fullName: name,
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0].trim() : null,
      skills,
    });
  });

  return { fragments, warnings };
}