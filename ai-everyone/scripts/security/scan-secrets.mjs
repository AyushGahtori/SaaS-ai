import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());

const SKIP_DIRS = new Set([
    ".git",
    ".next",
    "node_modules",
    "out",
    "build",
    "dist",
    "coverage",
]);

const SKIP_FILES = new Set([
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
]);

const SECRET_PATTERNS = [
    {
        name: "Google API key",
        regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    },
    {
        name: "GitHub personal access token",
        regex: /\bghp_[0-9A-Za-z]{36,}\b/g,
    },
    {
        name: "Generic bearer token assignment",
        regex: /\b(?:api[_-]?key|secret|token)\s*[:=]\s*['"]?[A-Za-z0-9_\-\.=]{20,}['"]?/gi,
    },
];

function shouldScanFile(filePath) {
    const fileName = path.basename(filePath);
    if (SKIP_FILES.has(fileName)) return false;
    if (fileName.startsWith(".env") && !fileName.endsWith(".example")) return false;
    if (fileName.endsWith(".png") || fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) return false;
    if (fileName.endsWith(".webp") || fileName.endsWith(".ico") || fileName.endsWith(".pdf")) return false;
    if (fileName.endsWith(".pyc") || fileName.endsWith(".zip")) return false;
    return true;
}

function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walk(entryPath, files);
            continue;
        }
        if (entry.isFile() && shouldScanFile(entryPath)) {
            files.push(entryPath);
        }
    }
    return files;
}

function isPlaceholder(text) {
    return /__SET_IN_(?:LOCAL|EC2)_RUNTIME__|your[_-]?key|example/i.test(text);
}

const matches = [];
for (const filePath of walk(ROOT)) {
    const rel = path.relative(ROOT, filePath).replaceAll("\\", "/");
    let content = "";
    try {
        content = fs.readFileSync(filePath, "utf8");
    } catch {
        continue;
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
        if (line.includes("process.env.")) return;
        for (const pattern of SECRET_PATTERNS) {
            pattern.regex.lastIndex = 0;
            const found = pattern.regex.exec(line);
            if (!found) continue;
            if (isPlaceholder(line)) continue;
            matches.push({
                file: rel,
                line: index + 1,
                pattern: pattern.name,
                text: line.trim().slice(0, 180),
            });
        }
    });
}

if (matches.length === 0) {
    console.log("Secret scan passed: no probable secrets detected.");
    process.exit(0);
}

console.error("Secret scan failed. Potential secrets detected:");
for (const match of matches) {
    console.error(`- ${match.file}:${match.line} [${match.pattern}] ${match.text}`);
}
process.exit(1);
