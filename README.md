# CORE//07 源码包

3D 核反应堆控制棒音频可视化程序。控制棒阵列直接呈现频谱：中心低频、外圈高频；不使用额外叠加的频谱圆环。

## 目录

- `reactor3d/`：网页与 3D 场景源码、Three.js 本地依赖及内置音频资源。
- `desktop/`：Electron 桌面壳、WASAPI 音频捕获与 Windows 启动器源码。

## 构建网页

在 `reactor3d/` 目录运行：

```powershell
node build.js
```

生成的离线 HTML 位于该目录，构建产物未放入本源码包。

## 运行桌面版

在 `desktop/` 目录运行：

```powershell
npm install
npm run sync
npm start
```

`npm run sync` 会从 `reactor3d/` 构建网页并复制到桌面应用目录。

## 构建 Windows 便携版

在 `desktop/` 目录运行：

```powershell
npm install
npm run dist
node make-launcher.js
```

便携版需要 Windows x64 环境。构建产物、依赖目录、测试录音和截图不包含在本源码包内。
