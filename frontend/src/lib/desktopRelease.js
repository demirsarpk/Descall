/**
 * Known-good Windows NSIS installer for when GitHub API is rate-limited.
 * Update this whenever cutting a new Electron release tag.
 */
export const DESKTOP_RELEASE_FALLBACK = {
  tagName: "v2.3.6",
  version: "2.3.6",
  name: "2.3.6",
  htmlUrl: "https://github.com/demirrsarppkurtlarr/Descall/releases/tag/v2.3.6",
  windowsDownloadUrl:
    "https://github.com/demirrsarppkurtlarr/Descall/releases/download/v2.3.6/Descall-Setup-2.3.6.exe",
  repo: "demirrsarppkurtlarr/Descall",
  fallback: true,
};
