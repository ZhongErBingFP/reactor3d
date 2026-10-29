const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

let LoopbackCapture = null;
let loopbackPath = '';
try {
  const loopback = require('loopback-capture');
  LoopbackCapture = loopback.LoopbackCapture;
  loopbackPath = loopback.path;
} catch (err) {
  console.error('loopback-capture failed to load:', err);
}

let mainWindow = null;
let capture = null;
let captureInfo = null;
let lastError = '';

function sendChunk(chunk) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.webContents || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send('core07:audio-chunk', chunk);
}

function stopCapture() {
  if (capture) {
    try {
      capture.stop();
    } catch (err) {
      console.warn('Capture stop failed:', err);
    }
    capture = null;
  }
  captureInfo = null;
}

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#050706',
    title: 'CORE//07 — Control Rod Matrix',
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html')).catch((err) => {
    console.error('Failed to load app:', err);
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (process.env.CORE07_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    stopCapture();
    mainWindow = null;
  });
}

function buildProcessListScript() {
  return [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$media = @('Spotify','cloudmusic','QQMusic','qqmusic','foobar2000','vlc','PotPlayerMini64','PotPlayerMini','MusicBee','aimp','chrome','msedge','firefox','brave','opera','Whale','TIDAL','Deezer','Music.UI','wmplayer')",
    "Get-Process | Where-Object { ($_.MainWindowTitle -and $_.MainWindowTitle.Trim().Length -gt 0) -or ($media -contains $_.ProcessName) } |",
    "Group-Object ProcessName | ForEach-Object {",
    "  $p = $_.Group | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Trim().Length -gt 0 } | Select-Object -First 1",
    "  if (-not $p) { $p = $_.Group | Select-Object -First 1 }",
    "  $title = if ($p.MainWindowTitle) { $p.MainWindowTitle.Trim() } else { $p.ProcessName }",
    "  [PSCustomObject]@{ pid = $p.Id; processName = $p.ProcessName; title = $title; name = $title }",
    "} | Sort-Object name | ConvertTo-Json -Compress"
  ].join('\n');
}

function listAudioSources() {
  return new Promise((resolve) => {
    execFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', buildProcessListScript()
    ], {
      windowsHide: true,
      timeout: 6000,
      maxBuffer: 2 * 1024 * 1024,
      encoding: 'utf8'
    }, (err, stdout) => {
      if (err) {
        console.warn('Process list failed:', err.message);
        resolve([]);
        return;
      }
      let text = String(stdout || '').replace(/^\uFEFF/, '').trim();
      if (!text) {
        resolve([]);
        return;
      }
      try {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const ownPids = new Set([process.pid]);
        try {
          app.getAppMetrics().forEach((m) => ownPids.add(m.pid));
        } catch (err) { /* noop */ }

        const sources = arr
          .filter((s) => s && Number.isFinite(Number(s.pid)) && Number(s.pid) > 0)
          .filter((s) => !ownPids.has(Number(s.pid)))
          .filter((s) => !/core07|electron/i.test(String(s.processName || '')))
          .filter((s) => !/CORE\/\/07|Control Rod Matrix/i.test(String(s.title || '')))
          .map((s) => ({
            pid: Number(s.pid),
            processName: String(s.processName || 'application'),
            title: String(s.title || s.processName || 'application'),
            name: String(s.name || s.title || s.processName || 'application')
          }));

        const seen = new Set();
        const deduped = sources.filter((s) => {
          const key = s.processName.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        resolve(deduped);
      } catch (parseErr) {
        console.warn('Process list parse failed:', parseErr, text.slice(0, 300));
        resolve([]);
      }
    });
  });
}

ipcMain.handle('core07:list-sources', async () => {
  return await listAudioSources();
});

ipcMain.handle('core07:start-audio', async (event, options) => {
  const opts = options || {};
  if (!LoopbackCapture) {
    return { ok: false, error: 'Native audio capture is unavailable. Reinstall the desktop build.' };
  }

  stopCapture();
  lastError = '';

  try {
    capture = new LoopbackCapture();
    if (opts.mode === 'process') {
      const pid = Number(opts.pid);
      if (!Number.isFinite(pid) || pid <= 0) {
        return { ok: false, error: 'Invalid process id.' };
      }
      captureInfo = { mode: 'process', pid };
      capture.start(pid, true, sendChunk);
    } else {
      captureInfo = { mode: 'system' };
      capture.startSystemAudio(sendChunk);
    }
    return { ok: true, mode: captureInfo.mode, pid: captureInfo.pid || null };
  } catch (err) {
    console.error('Start audio capture failed:', err);
    lastError = err && err.message ? err.message : String(err);
    stopCapture();
    return { ok: false, error: lastError };
  }
});

ipcMain.handle('core07:stop-audio', async () => {
  stopCapture();
  return { ok: true };
});

ipcMain.handle('core07:audio-state', async () => ({
  capturing: !!capture,
  info: captureInfo,
  error: lastError,
  nativePath: loopbackPath
}));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media' || permission === 'audioCapture' || permission === 'display-capture') {
        callback(true);
        return;
      }
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      return permission === 'media' || permission === 'audioCapture' || permission === 'display-capture';
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('before-quit', () => {
  stopCapture();
});

app.on('window-all-closed', () => {
  stopCapture();
  app.quit();
});
