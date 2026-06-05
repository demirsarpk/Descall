const fs = require('fs');

const nextVer = process.argv[2];
if (!nextVer) {
  console.error('Usage: node update-download-page.cjs <version>');
  process.exit(1);
}

const filePath = '../src/components/download/DownloadPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace version in fallback URL tag part: v2.1.0 -> v2.2.8
content = content.replace(
  /releases\/download\/v\d+\.\d+\.\d+/g,
  `releases/download/v${nextVer}`
);

// Replace version in filename: Descall-Setup-2.1.0.exe -> Descall-Setup-2.2.8.exe
content = content.replace(
  /Descall-Setup-\d+\.\d+\.\d+\.exe/g,
  `Descall-Setup-${nextVer}.exe`
);

fs.writeFileSync(filePath, content);
console.log(`Updated DownloadPage.jsx fallback to v${nextVer}`);
process.exit(0);
