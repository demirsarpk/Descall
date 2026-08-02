/**
 * Known-good Windows NSIS installer for when GitHub API is rate-limited.
 * Update this whenever cutting a new Electron release tag.
 */
export const DESKTOP_RELEASE_FALLBACK = {
  tagName: "v2.3.5",
  version: "2.3.5",
  name: "2.3.5",
  htmlUrl: "https://github.com/demirrsarppkurtlarr/Descall/releases/tag/v2.3.5",
  windowsDownloadUrl:
    "https://github.com/demirrsarppkurtlarr/Descall/releases/download/v2.3.5/Descall-Setup-2.3.5.exe",
  repo: "demirrsarppkurtlarr/Descall",
  fallback: true,
};
