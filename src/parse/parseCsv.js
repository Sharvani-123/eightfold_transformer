/**
* Parses a recruiter CSV export into an array of raw fragments.
* Each fragment is a loose, source-shaped record - no normalization here,
* that happens later in the Standardize stage.
 */

export function parseCsv(raw, filePath) {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length<2) {
    return { fragments: [], warnings: [{ filePath, message: "CSV has no data rows" }] };
  }

  const headers = lines[0].split(",").map((h) => h.trim());
  const fragments = [];
  const warnings = [];

  for (let i=1; i<lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());

    if (cells.length!==headers.length) {
      warnings.push({
        filePath,
        message: `Row ${i + 1} has ${cells.length} columns, expected ${headers.length} - missing fields set to null`,
      });
    }

    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] !== undefined && cells[idx] !== "" ? cells[idx] : null;
    });

    fragments.push({
      source: "recruiter_csv",
      method: "csv_row",
      rawIndex: i,
      fullName: row.name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      company: row.current_company ?? null,
      title: row.title ?? null,
    });
  }

  return { fragments, warnings };
}