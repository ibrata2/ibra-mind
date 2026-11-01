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
    void mainWindow.webContents.executeJavaScript('new Promise(resolve=>{const started=Date.now();const check=()=>{const root=document.getElementById("root");if(root&&root.children.length&&root.innerText.includes("IBRA MIND"))return resolve({ready:true});if(Date.now()-started>=30000)return resolve({ready:false,url:location.href,state:document.readyState,title:document.title,body:document.body?.innerText?.slice(0,500),root:root?.outerHTML?.slice(0,1000),resources:performance.getEntriesByType("resource").map(x=>x.name).slice(-20)});setTimeout(check,100);};check();})')
      .then((result) => {
        process.stdout.write(result.ready ? 'IBRA_MIND_RENDERER_OK\n' : `IBRA_MIND_RENDERER_EMPTY ${JSON.stringify(result)}\n`);
        if (!result.ready) process.exitCode = 1;
        app.quit();
      })
      .catch((error) => { process.stderr.write(`IBRA_MIND_RENDERER_ERROR ${error.message}\n`); process.exitCode = 1; app.quit(); });
  });
  if (process.env.IBRA_MIND_SMOKE === '1') {
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => process.stderr.write(`RENDERER_CONSOLE level=${level} ${message} (${sourceId}:${line})\n`));
    mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => process.stderr.write(`RENDERER_LOAD_FAILED ${code} ${description} ${url}\n`));
    mainWindow.webContents.on('render-process-gone', (_event, details) => process.stderr.write(`RENDERER_GONE ${details.reason} exit=${details.exitCode}\n`));
  }
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
  ipcMain.handle('auth:take-pending', (event) => {
    if (!isAppOrigin(event.sender.getURL())) return '';
    const value = pendingAuthUrl;
    pendingAuthUrl = '';
    return value;
  });
  ipcMain.handle('auth:ack', (event, value) => {
    if (!isAppOrigin(event.sender.getURL())) return { ok: false };
    if (pendingAuthUrl === value) pendingAuthUrl = '';
    return { ok: true };
  });
  const authStorageFile = () => path.join(app.getPath('userData'), 'auth-session.enc');
  const authStorage = createEncryptedAuthStorage({ safeStorage, filePath: authStorageFile });
  ipcMain.handle('auth:storage:get', (event, key) => {
    if (!isAppOrigin(event.sender.getURL())) return null;
    return authStorage.get(key);
  });
  ipcMain.handle('auth:storage:set', (event, key, value) => {
    if (!isAppOrigin(event.sender.getURL())) throw new Error('مصدر التطبيق غير صالح.');
    authStorage.set(key, value);
  });
  ipcMain.handle('auth:storage:remove', (event, key) => {
    if (!isAppOrigin(event.sender.getURL())) throw new Error('مصدر التطبيق غير صالح.');
    authStorage.remove(key);
  });
  createProviderService({ app, ipcMain, safeStorage });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

