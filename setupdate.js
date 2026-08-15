#!/usr/bin/env node
/**
 * Sets the version in every file that declares one.
 *
 *   npm run setupdate 2.10.0
 *
 * Nothing is written unless every target matches, so a rename or a reformat can
 * never leave half the files bumped.
 */

const fs = require("fs");
const path = require("path");

// ipm requires exactly three numeric parts, so anything else is rejected outright.
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const targets = [
  { file: "package.json", pattern: /^(\s*"version"\s*:\s*")([^"]*)(")/m },
  { file: "ipm-package.yaml", pattern: /^(version\s*:\s*")([^"]*)(")/m },
  { file: "PKGBUILD", pattern: /^(pkgver=)(.*)$/m },
];

function fail(message) {
  console.error(`setupdate: ${message}`);
  process.exit(1);
}

const version = process.argv[2];
if (!version) fail("no version given. Usage: npm run setupdate <version>   (e.g. 2.10.0)");
if (!VERSION_PATTERN.test(version)) fail(`"${version}" is not a valid version. Expected three numbers, e.g. 2.10.0`);

const pending = [];

for (const target of targets) {
  const filePath = path.resolve(__dirname, target.file);

  let contents;
  try {
    contents = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`could not read ${target.file}: ${error.message}`);
  }

  const match = contents.match(target.pattern);
  if (!match) fail(`could not find a version to replace in ${target.file}`);

  const previous = match[2];
  // Read the surrounding text off the match itself; patterns without a trailing
  // group (PKGBUILD) simply have nothing to put back.
  const prefix = match[1];
  const suffix = match[3] ?? "";
  let updated = contents.replace(target.pattern, () => `${prefix}${version}${suffix}`);

  // A new upstream version starts its packaging revision over.
  if (target.file === "PKGBUILD" && previous !== version) {
    updated = updated.replace(/^pkgrel=.*$/m, "pkgrel=1");
  }

  pending.push({ file: target.file, filePath, contents: updated, previous, changed: updated !== contents });
}

for (const entry of pending) {
  if (!entry.changed) {
    console.log(`  ${entry.file}: already ${version}`);
    continue;
  }
  fs.writeFileSync(entry.filePath, entry.contents);
  console.log(`  ${entry.file}: ${entry.previous} -> ${version}`);
}

console.log(`\nVersion set to ${version}.`);
