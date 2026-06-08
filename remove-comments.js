#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "assets",
  "purged-css",
]);

const JS_LIKE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".css",
]);
const HTML_LIKE_EXTENSIONS = new Set([".html", ".htm", ".ejs", ".xml", ".svg"]);

function isIgnoredDir(dirName) {
  return IGNORED_DIRS.has(dirName.toLowerCase());
}

function collectFiles(startDir, files = []) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(startDir, entry.name);

    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name)) {
        continue;
      }

      collectFiles(fullPath, files);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (JS_LIKE_EXTENSIONS.has(ext) || HTML_LIKE_EXTENSIONS.has(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

function stripJsLikeComments(source) {
  let out = "";
  let i = 0;
  const len = source.length;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inBlockComment = false;
  let inLineComment = false;

  while (i < len) {
    const ch = source[i];
    const next = i + 1 < len ? source[i + 1] : "";
    const prev = i > 0 ? source[i - 1] : "";

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += ch;
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
      } else {
        if (ch === "\n") {
          out += "\n";
        }
        i += 1;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
      if (ch === "/" && next === "/") {
        inLineComment = true;
        i += 2;
        continue;
      }

      if (ch === "/" && next === "*") {
        inBlockComment = true;
        i += 2;
        continue;
      }
    }

    if (!inDoubleQuote && !inTemplate && ch === "'" && prev !== "\\") {
      inSingleQuote = !inSingleQuote;
      out += ch;
      i += 1;
      continue;
    }

    if (!inSingleQuote && !inTemplate && ch === '"' && prev !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      out += ch;
      i += 1;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && ch === "`" && prev !== "\\") {
      inTemplate = !inTemplate;
      out += ch;
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function stripHtmlComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, "");
}

function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const input = fs.readFileSync(filePath, "utf8");

  let output = input;
  if (JS_LIKE_EXTENSIONS.has(ext)) {
    output = stripJsLikeComments(input);
  } else if (HTML_LIKE_EXTENSIONS.has(ext)) {
    output = stripHtmlComments(input);
  }

  if (output !== input) {
    fs.writeFileSync(filePath, output, "utf8");
    return true;
  }

  return false;
}

function main() {
  const allFiles = collectFiles(rootDir);
  let changedCount = 0;

  for (const filePath of allFiles) {
    if (processFile(filePath)) {
      changedCount += 1;
    }
  }

  console.log(
    `Scanned ${allFiles.length} files. Updated ${changedCount} files.`,
  );
}

main();
