const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopRoot = __dirname;
const webRoot = path.resolve(desktopRoot, '..', 'reactor3d');
const appDir = path.join(desktopRoot, 'app');

console.log('Building web application…');
execFileSync(process.execPath, [path.join(webRoot, 'build.js')], {
  cwd: webRoot,
  stdio: 'inherit'
});

fs.mkdirSync(appDir, { recursive: true });
fs.copyFileSync(path.join(webRoot, 'index.html'), path.join(appDir, 'index.html'));
console.log('Copied renderer to desktop/app/index.html');
