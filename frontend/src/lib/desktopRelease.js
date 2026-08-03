/**
 * Known-good Windows NSIS installer for when GitHub API is rate-limited.
 * Update this whenever cutting a new Electron release tag.
 */
export const DESKTOP_RELEASE_FALLBACK = {
  tagName: "v2.5.0",
  version: "2.5.0",
  name: "2.5.0",
  htmlUrl: "https://github.com/demirrsarppkurtlarr/Descall/releases/tag/v2.5.0",
  windowsDownloadUrl:
    "https://github.com/demirrsarppkurtlarr/Descall/releases/download/v2.5.0/Descall-Setup-2.5.0.exe",
  repo: "demirrsarppkurtlarr/Descall",
  fallback: true,
};
