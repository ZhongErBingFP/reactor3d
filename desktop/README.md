# CORE//07 Desktop

Windows Electron wrapper for CORE//07. It captures local system or application audio through WASAPI and sends audio data to the shared renderer.

## Development

From this directory:

```powershell
npm install
npm run sync
npm start
```

`npm run sync` builds the renderer from `../reactor3d` and copies the generated page to `app/index.html`.

## Windows portable build

On Windows x64:

```powershell
npm install
npm run dist
node make-launcher.js
```

The first command builds the Electron portable runtime. The second creates the single-file launcher.

## Main files

- `main.js`: Electron main process, audio capture and IPC.
- `preload.js`: renderer bridge.
- `sync.js`: builds and copies the web renderer.
- `make-launcher.js` and `build/launcher.cs`: single-file launcher source.
- `build/icon.ico`: Windows application icon.
