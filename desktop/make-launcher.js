const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const csc = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const portable = path.join(root, 'dist', 'CORE07.exe');
const source = path.join(root, 'build', 'launcher.cs');
const icon = path.join(root, 'build', 'icon.ico');
const releaseDir = path.join(root, 'release');
const output = path.join(releaseDir, 'CORE07.exe');

if (!fs.existsSync(csc)) throw new Error('C# compiler not found: ' + csc);
if (!fs.existsSync(portable)) throw new Error('Portable app missing. Run npm run dist first: ' + portable);

fs.mkdirSync(releaseDir, { recursive: true });
const args = [
  '/nologo',
  '/target:winexe',
  '/platform:anycpu',
  '/optimize+',
  '/win32icon:' + icon,
  '/resource:' + portable + ',CORE07Payload',
  '/out:' + output,
  source
];

console.log('Compiling single-file launcher…');
execFileSync(csc, args, { cwd: root, stdio: 'inherit' });

const readme = `CORE//07 桌面版

双击 CORE07.exe 启动。

这是单文件启动器：首次启动会把内置运行时复制到
  %PUBLIC%\\CORE07
之后直接从该目录启动，避免中文路径导致的 Electron 兼容问题。

功能：
- 直接在「电脑声音」里选择系统声音或某个程序声音
- 中英文一键切换（右上角）
- 灵敏度 / 控制棒振幅调节（底部 SENS 或右侧遥测面板）
- 本地音乐、麦克风、演示节拍
- 无需安装、无需联网

首次启动需要解压运行时，可能等待数秒。
本程序未做商业代码签名，Windows SmartScreen 可能提示未知发布者。
`;

fs.writeFileSync(path.join(releaseDir, '使用说明.txt'), readme, 'utf8');
fs.writeFileSync(path.join(releaseDir, 'CORE07.exe.sha256.txt'),
  require('crypto').createHash('sha256').update(fs.readFileSync(output)).digest('hex') + '  CORE07.exe\n', 'utf8');

console.log('Built ' + output);
console.log('  Size: ' + (fs.statSync(output).size / (1024 * 1024)).toFixed(1) + ' MiB');
