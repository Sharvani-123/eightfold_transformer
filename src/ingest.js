import fs from "fs";
import path from "path";

/**
 * Detects the source type from a file path and reads the raw contents.
 * Returns {sourceType, raw, filePath} or throws a descriptive error
 * for missing/unreadble files (caught by the caller, never crashes the run).
 */

export function ingest(filePath){
    const ext = path.extname(filePath).toLowerCase();

    if(!fs.existsSync(filePath)){
        throw new Error(`File not found : ${filePath}`);
    }

    let raw;
    try{
        raw= fs.readFileSync(filePath,"utf-8");
    } catch(err){
        throw new Error(`Unable to read file ${filePath}: ${err.message}`);
    }

    if(!raw || raw.trim().length===0){
        throw new Error(`File is empty: ${filePath}`);
    }

    let sourceType;
    if (ext === ".csv") {
        sourceType = "recruiter_csv";
    } else if (ext === ".txt") {
        sourceType = "recruiter_notes";
    }
    else{
        throw new Error(`Unsupported file type: ${ext} (${filePath})`);
    }

    return { sourceType, raw, filePath};
}

/**
 * Ingests a list of file paths. Failures on individual files
 * are collected as warnings rather than stopping the whole run.
 */

export function ingestAll(filePaths){
    const ingested = [];
    const warnings = [];

    for(const fp of filePaths){
        try {
            ingested.push(ingest(fp));
        } catch (err) {
            warnings.push({filePath:fp, message:err.message});
        }
    }

    return {ingested, warnings};
}