/**
 * Known-good Windows NSIS installer for when GitHub API is rate-limited.
 * Update this whenever cutting a new Electron release tag.
 */
export const DESKTOP_RELEASE_FALLBACK = {
  tagName: "v2.6.2",
  version: "2.6.2",
  name: "2.6.2",
  htmlUrl: "https://github.com/demirsarpk/Descall/releases/tag/v2.6.2",
  windowsDownloadUrl:
    "https://github.com/demirsarpk/Descall/releases/download/v2.6.2/Descall-Setup-2.6.2.exe",
  repo: "demirsarpk/Descall",
  fallback: true,
};
