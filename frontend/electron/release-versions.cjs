const pkg = require('./package.json');
const [major, minor, patch] = pkg.version.split('.').map(Number);
console.log('CURRENT_VER=' + pkg.version);
console.log('NEXT_PATCH=' + major + '.' + minor + '.' + (patch + 1));
console.log('NEXT_MINOR=' + major + '.' + (minor + 1) + '.0');
console.log('NEXT_MAJOR=' + (major + 1) + '.0.0');
