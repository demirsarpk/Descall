const pkg = require('./package.json');
const [major, minor, patch] = pkg.version.split('.').map(Number);

console.log('CURRENT_VER=' + pkg.version);

// Standard semantic versioning bumps
console.log('NEXT_PATCH=' + major + '.' + minor + '.' + (patch + 1));
console.log('NEXT_MINOR=' + major + '.' + (minor + 1) + '.0');
console.log('NEXT_MAJOR=' + (major + 1) + '.0.0');

// Granular micro-patch bumps for small bug fixes
console.log('NEXT_MICRO_1=' + major + '.' + minor + '.' + (patch + 1));
console.log('NEXT_MICRO_2=' + major + '.' + minor + '.' + (patch + 2));
console.log('NEXT_MICRO_3=' + major + '.' + minor + '.' + (patch + 3));
console.log('NEXT_MICRO_5=' + major + '.' + minor + '.' + (patch + 5));
console.log('NEXT_MICRO_10=' + major + '.' + minor + '.' + (patch + 10));

// Custom version placeholder (will be set by user input)
console.log('CUSTOM_VER=' + pkg.version);
