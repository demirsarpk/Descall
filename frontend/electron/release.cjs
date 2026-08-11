#!/usr/bin/env node
/**
 * release.cjs
 * -----------
 * Full automated release pipeline:
 *  1. Bump patch version in package.json
 *  2. Run electron-builder --win
 *  3. Create a GitHub Release (tag vX.Y.Z)
 *  4. Upload Setup .exe, blockmap, and latest.yml
 *
 * Usage:
 *   node release.cjs              → bump patch (2.0.0 → 2.0.1)
 *   node release.cjs --minor      → bump minor (2.0.0 → 2.1.0)
 *   node release.cjs --major      → bump major (2.0.0 → 3.0.0)
 *   node release.cjs --no-bump    → keep current version, just build & release
 *
 * Requires env var:  GH_TOKEN=<your GitHub PAT with repo scope>
 */

const fs   = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const https = require("https");

// ── Config ─────────────────────────────────────────────────────────────────
const OWNER      = "demirsarpk";
const REPO       = "Descall";
const PKG_PATH   = path.join(__dirname, "package.json");
const DIST_DIR   = path.join(__dirname, "dist");

const GH_TOKEN = process.env.GH_TOKEN;
if (!GH_TOKEN) {
  console.error("[release] ❌  GH_TOKEN environment variable is not set.");
  console.error("           Set it with:  $env:GH_TOKEN='ghp_...'  (PowerShell)");
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function githubRequest(method, urlPath, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "api.github.com",
      path:     urlPath,
      method,
      headers: {
        "Authorization": `token ${GH_TOKEN}`,
        "User-Agent":    "descall-release-script",
        "Accept":        "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        ...extraHeaders,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function uploadAsset(uploadUrl, filePath) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);
    const ext      = path.extname(fileName).toLowerCase();
    const mimeMap  = {
      ".exe":      "application/octet-stream",
      ".blockmap": "application/octet-stream",
      ".yml":      "text/yaml",
      ".yaml":     "text/yaml",
    };
    const mimeType = mimeMap[ext] || "application/octet-stream";

    // uploadUrl looks like: https://uploads.github.com/repos/.../releases/.../assets{?name,label}
    const base = uploadUrl.replace(/\{.*\}/, "");
    const url  = new URL(`${base}?name=${encodeURIComponent(fileName)}`);

    const options = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   "POST",
      headers: {
        "Authorization":  `token ${GH_TOKEN}`,
        "User-Agent":     "descall-release-script",
        "Accept":         "application/vnd.github+json",
        "Content-Type":   mimeType,
        "Content-Length": fileData.length,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.write(fileData);
    req.end();
  });
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const args   = process.argv.slice(2);
  const noBump = args.includes("--no-bump");
  const bumpType = args.includes("--major") ? "major"
                 : args.includes("--minor") ? "minor"
                 : "patch";

  // 1. Read & optionally bump version
  const pkg     = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
  const oldVer  = pkg.version;
  const newVer  = noBump ? oldVer : bumpVersion(oldVer, bumpType);

  if (!noBump) {
    pkg.version = newVer;
    fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    console.log(`[release] 📦  Version bumped: ${oldVer} → ${newVer} (${bumpType})`);
    try {
      execSync(`node sync-version.cjs ${newVer}`, { cwd: __dirname, stdio: "inherit" });
    } catch (e) {
      console.warn("[release] ⚠️  sync-version.cjs failed:", e.message);
    }
  } else {
    console.log(`[release] 📦  Using existing version: ${newVer}`);
  }

  // 2. Build
  console.log("[release] 🔨  Building Electron app…");
  try {
    execSync("npm run build:win", {
      cwd:   __dirname,
      stdio: "inherit",
    });
  } catch (err) {
    console.error("[release] ❌  Build failed.");
    // Restore version on failure
    if (!noBump) { pkg.version = oldVer; fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n"); }
    process.exit(1);
  }

  // 3. Collect artifacts
  const setupExe   = path.join(DIST_DIR, `Descall-Setup-${newVer}.exe`);
  const blockmap   = path.join(DIST_DIR, `Descall-Setup-${newVer}.exe.blockmap`);
  const latestYml  = path.join(DIST_DIR, "latest.yml");

  const missingFiles = [setupExe, blockmap, latestYml].filter((f) => !fs.existsSync(f));
  if (missingFiles.length) {
    console.error("[release] ❌  Missing build artifacts:");
    missingFiles.forEach((f) => console.error("           -", f));
    process.exit(1);
  }

  // 4. Create GitHub Release
  const tagName = `v${newVer}`;
  console.log(`[release] 🚀  Creating GitHub release ${tagName}…`);

  // Delete existing release with same tag if any (idempotent reruns)
  const existingRelease = await githubRequest("GET", `/repos/${OWNER}/${REPO}/releases/tags/${tagName}`);
  if (existingRelease.status === 200) {
    const releaseId = existingRelease.body.id;
    console.log(`[release] 🗑   Deleting existing release ${tagName} (id=${releaseId})…`);
    await githubRequest("DELETE", `/repos/${OWNER}/${REPO}/releases/${releaseId}`);
    // Also delete the tag
    await githubRequest("DELETE", `/repos/${OWNER}/${REPO}/git/refs/tags/${tagName}`);
  }

  const bumpLabel =
    bumpType === "major" ? "Major release (breaking changes)"
    : bumpType === "minor" ? "Minor release (new features)"
    : "Patch release (fixes and small updates)";

  const createRes = await githubRequest("POST", `/repos/${OWNER}/${REPO}/releases`, {
    tag_name:         tagName,
    target_commitish: "main",
    name:             `Descall ${newVer}`,
    body:             `## Descall ${newVer}\n\n**${bumpLabel}**\n\nAutomated Electron desktop release.\n\n- Windows: \`Descall-Setup-${newVer}.exe\`\n- Website download page picks up this tag automatically via \`/api/app/latest-release\`.`,
    draft:            false,
    prerelease:       false,
  });

  if (createRes.status !== 201) {
    console.error("[release] ❌  Failed to create release:", createRes.body);
    process.exit(1);
  }

  const uploadUrl = createRes.body.upload_url;
  const htmlUrl   = createRes.body.html_url;
  console.log(`[release] ✅  Release created: ${htmlUrl}`);

  // 5. Upload assets
  const artifacts = [
    { label: "Setup EXE",   file: setupExe  },
    { label: "Blockmap",    file: blockmap  },
    { label: "latest.yml",  file: latestYml },
  ];

  for (const { label, file } of artifacts) {
    console.log(`[release] ⬆️   Uploading ${label} (${path.basename(file)})…`);
    const res = await uploadAsset(uploadUrl, file);
    if (res.status !== 201) {
      console.error(`[release] ❌  Upload failed for ${label}:`, res.body);
      process.exit(1);
    }
    console.log(`[release] ✅  ${label} uploaded.`);
  }

  // 6. Commit synced versions (site reads GitHub latest — no hardcoded fallback URL)
  if (!noBump) {
    console.log("[release] 📤  Committing version bump and pushing…");
    try {
      const repoRoot = path.join(__dirname, "..", "..");
      execSync(`git add "${PKG_PATH}"`, { cwd: repoRoot, stdio: "inherit" });
      execSync(`git add "${path.join(__dirname, "..", "package.json")}"`, { cwd: repoRoot, stdio: "inherit" });
      execSync(`git add "${path.join(repoRoot, "package.json")}"`, { cwd: repoRoot, stdio: "inherit" });
      execSync(`git commit -m "chore(electron): release v${newVer} (${bumpType})"`, { cwd: repoRoot, stdio: "inherit" });
      execSync("git push", { cwd: repoRoot, stdio: "inherit" });
    } catch (err) {
      console.warn("[release] ⚠️   Git push failed (non-fatal):", err.message);
    }
  }

  console.log(`\n[release] 🎉  Done! Descall ${newVer} is live at:\n           ${htmlUrl}\n`);
  console.log(`[release] ℹ️   Landing page will show "${tagName} available" after /api/app/latest-release refreshes.\n`);
})();
