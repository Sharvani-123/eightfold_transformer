import fs from "fs";
import path from "path";
import { runPipeline } from "./src/pipeline.js";

/**
 * Usage:
 *   node cli.js --inputs samples/recruiter_export.csv,samples/recruiter_notes.txt
 *   node cli.js --inputs <files> --config config/sample-config.json
 *   node cli.js --inputs <files> --config config/sample-config.json --out output/result.json
 *
 * If --inputs is omitted, defaults to the two sample files in samples/.
 */

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
      args[key] = value;
      if (value !== true) i++;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);

  const inputFiles = args.inputs
    ? args.inputs.split(",").map((p) => p.trim())
    : ["samples/recruiter_export.csv", "samples/recruiter_notes.txt"];

  let config = null;
  if (args.config) {
    try {
      config = JSON.parse(fs.readFileSync(args.config, "utf-8"));
    } catch (err) {
      console.error(`Failed to read/parse config at ${args.config}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`Running pipeline on: ${inputFiles.join(", ")}`);
  console.log(`Config: ${args.config ?? "(default schema)"}\n`);

  const { output, warnings } = runPipeline(inputFiles, config);

  console.log(JSON.stringify(output, null, 2));

  if (warnings.length > 0) {
    console.error(`\n--- ${warnings.length} warning(s) ---`);
    warnings.forEach((w) => console.error(w));
  }

  if (args.out) {
    const outDir = path.dirname(args.out);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(output, null, 2));
    console.log(`\nOutput written to ${args.out}`);
  }
}

main();