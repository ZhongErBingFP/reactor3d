/* Build a single, offline double-clickable HTML file. */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const template = fs.readFileSync(path.join(root, 'src', 'index.template.html'), 'utf8');
const style = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
const three = fs.readFileSync(path.join(root, 'vendor', 'three.min.js'), 'utf8');
const jsDir = path.join(root, 'src', 'js');
const files = fs.readdirSync(jsDir).filter((name) => name.endsWith('.js')).sort();

const builtinPath = path.join(root, 'assets', '朋友的酒DJ.m4a');
let builtinCode = '';
if (fs.existsSync(builtinPath)) {
  const audio = fs.readFileSync(builtinPath);
  builtinCode = 'window.__BUILTIN_TRACK__ = ' + JSON.stringify({
    name: '朋友的酒 DJ',
    file: '朋友的酒DJ.m4a',
    mime: 'audio/mp4',
    data: audio.toString('base64')
  }) + ';';
}

const app = [
  '(function () {',
  "'use strict';",
  builtinCode,
  files.map((name) => '\n/* ===== ' + name + ' ===== */\n' + fs.readFileSync(path.join(jsDir, name), 'utf8')).join('\n'),
  '})();'
].join('\n');

function safeInline(code) {
  return code.replace(/<\/script/gi, '<\\/script');
}

const html = template
  .replace('/*__STYLE__*/', () => style)
  .replace('/*__THREE__*/', () => safeInline(three))
  .replace('/*__APP__*/', () => safeInline(app));

const outputs = [
  path.join(root, 'index.html'),
  path.join(root, '控制棒矩阵.html')
];

for (const out of outputs) {
  fs.writeFileSync(out, html, 'utf8');
}

console.log('Built ' + outputs.map((p) => path.basename(p)).join(' + '));
console.log('  Three.js: ' + (three.length / 1024).toFixed(1) + ' KiB');
console.log('  Built-in: ' + (builtinCode.length / 1024 / 1024).toFixed(2) + ' MiB (base64)');
console.log('  App JS  : ' + (app.length / 1024).toFixed(1) + ' KiB');
console.log('  HTML    : ' + (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KiB');
console.log('  Sources : ' + files.join(', '));
