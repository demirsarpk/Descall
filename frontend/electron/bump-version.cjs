const fs = require('fs');

const type = process.argv[2];
const increment = process.argv[3] || '1';

const pkg = JSON.parse(fs.readFileSync('package.json'));
const v = pkg.version.split('.');

if (type === 'patch') {
  v[2] = parseInt(v[2]) + 1;
  pkg.version = v.join('.');
} else if (type === 'minor') {
  v[1] = parseInt(v[1]) + 1;
  v[2] = 0;
  pkg.version = v.join('.');
} else if (type === 'major') {
  v[0] = parseInt(v[0]) + 1;
  v[1] = 0;
  v[2] = 0;
  pkg.version = v.join('.');
} else if (type === 'micro') {
  v[2] = parseInt(v[2]) + parseInt(increment);
  pkg.version = v.join('.');
} else if (type === 'custom') {
  pkg.version = increment;
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log(pkg.version);
process.exit(0);
