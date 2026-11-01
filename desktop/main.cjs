const { app, BrowserWindow, Menu, ipcMain, safeStorage, session } = require('electron');
const path = require('node:path');
const { createProviderService } = require('./provider-service.cjs');
const { createEncryptedAuthStorage } = require('./auth-storage.cjs');
const AUTH_PROTOCOL = 'ibramind';
const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) app.quit();
let mainWindow = null;
let pendingAuthUrl = '';

function captureAuthUrl(value) {
  if (typeof value !== 'string' || !value.startsWith(`${AUTH_PROTOCOL}://auth`)) return;
  pendingAuthUrl = value;
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', deliverAuthUrl);
    else deliverAuthUrl();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

function deliverAuthUrl() {
  if (!pendingAuthUrl || !mainWindow || mainWindow.isDestroyed()) return;
  const value = pendingAuthUrl;
  mainWindow.webContents.send('auth:callback', value);
}

if (hasSingleInstance) {
  app.on('second-instance', (_event, commandLine) => captureAuthUrl(commandLine.find((argument) => argument.startsWith(`${AUTH_PROTOCOL}://`))));
  app.on('open-url', (event, value) => { event.preventDefault(); captureAuthUrl(value); });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 640,
    title: 'IBRA MIND',
    icon: path.join(__dirname, '..', 'assets', 'ibra-mind.ico'),
    backgroundColor: '#f4f6fb',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.webContents.once('did-finish-load', () => {
    deliverAuthUrl();
    if (process.env.IBRA_MIND_SMOKE !== '1') return;
    void mainWindow.webContents.executeJavaScript('(()=>{const root=document.getElementById("root");return Boolean(root&&root.children.length&&root.innerText.includes("IBRA MIND"));})()')
      .then((loaded) => {
        process.stdout.write(loaded ? 'IBRA_MIND_RENDERER_OK\n' : 'IBRA_MIND_RENDERER_EMPTY\n');
        if (!loaded) process.exitCode = 1;
        app.quit();
      })
      .catch((error) => { process.stderr.write(`IBRA_MIND_RENDERER_ERROR ${error.message}\n`); process.exitCode = 1; app.quit(); });
  });
  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

if (hasSingleInstance) app.whenReady().then(() => {
  if (process.defaultApp) {
    if (process.argv.length >= 2) app.setAsDefaultProtocolClient(AUTH_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  } else app.setAsDefaultProtocolClient(AUTH_PROTOCOL);
  captureAuthUrl(process.argv.find((argument) => argument.startsWith(`${AUTH_PROTOCOL}://`)));
  Menu.setApplicationMenu(null);
  let microphonePermissionArmed = false;
  const isAppOrigin = (url) => {
    if (app.isPackaged) return url.startsWith('file://');
    try { const parsed = new URL(url); return parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname) && parsed.port === '5173'; }
    catch { return false; }
  };
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const mediaTypes = details?.mediaTypes || [];
    const audioOnly = mediaTypes.length === 0 || (mediaTypes.includes('audio') && !mediaTypes.includes('video'));
    const allowed = permission === 'media' && audioOnly && microphonePermissionArmed && isAppOrigin(webContents.getURL());
    if (allowed) microphonePermissionArmed = false;
    callback(allowed);
  });
  ipcMain.handle('app:request-microphone', (event) => {
    if (!isAppOrigin(event.sender.getURL())) return { ok: false, error: 'مصدر التطبيق غير صالح.' };
    microphonePermissionArmed = true;
    return { ok: true };
  });
  ipcMain.handle('auth:take-pend