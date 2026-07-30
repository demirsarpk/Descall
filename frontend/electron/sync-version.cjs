#!/usr/bin/env node
/**
 * Write the same semver to all Descall package manifests (Electron + web app).
 * Usage: node sync-version.cjs 2.4.0
 */
const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: node sync-version.cjs <semver>   e.g. 2.4.0");
  process.exit(1);
}

const targets = [
  path.join(__dirname, "package.json"),
  path.join(__dirname, "..", "package.json"),
  path.join(__dirname, "..", "..", "package.json"),
];

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (pkg.version === version) {
    console.log(`[sync-version] skip ${file} (already ${version})`);
    continue;
  }
  pkg.version = version;
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  console.log(`[sync-version] ${file} → ${version}`);
}
