/**
 * Known-good Windows NSIS installer for when GitHub API is rate-limited.
 * Update this whenever cutting a new Electron release tag.
 */
export const DESKTOP_RELEASE_FALLBACK = {
  tagName: "v2.3.4",
  version: "2.3.4",
  name: "2.3.4",
  htmlUrl: "https://github.com/demirrsarppkurtlarr/Descall/releases/tag/v2.3.4",
  windowsDownloadUrl:
    "https://github.com/demirrsarppkurtlarr/Descall/releases/download/v2.3.4/Descall-Setup-2.3.4.exe",
  repo: "demirrsarppkurtlarr/Descall",
  fallback: true,
};
