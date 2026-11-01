const { app, BrowserWindow, Menu, ipcMain, safeStorage, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createProviderService } = require('./provider-service.cjs');
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
    backgroundColor: '#f4f6fb',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.webContents.once('did-finish-load', deliverAuthUrl);
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
  const isSupabaseAuthKey = (key) => typeof key === 'string' && /^sb-[a-z0-9-]+-auth-token$/.test(key);
  ipcMain.handle('auth:storage:get', (event, key) => {
    if (!isAppOrigin(event.sender.getURL())) return null;
    if (!isSupabaseAuthKey(key)) throw new Error('مفتاح جلسة الحساب غير صالح.');
    const file = authStorageFile();
    if (!fs.existsSync(file)) return null;
    if (!safeStorage.isEncryptionAvailable()) throw new Error('تخزين جلسة الحساب المشفر غير متاح على هذا الجهاز.');
    try {
      const stored = JSON.parse(safeStorage.decryptString(Buffer.from(fs.readFileSync(file, 'utf8'), 'base64')));
      return stored?.key === key && typeof stored.value === 'string' ? stored.value : null;
    } catch {
      fs.unlinkSync(file);
      return null;
    }
  });
  ipcMain.handle('auth:storage:set', (event, key, value) => {
    if (!isAppOrigin(event.sender.getURL())) throw new Error('مصدر التطبيق غير صالح.');
    if (!isSupabaseAuthKey(key) || typeof value !== 'string' || value.length > 128_000) throw new Error('بيانات جلسة الحساب غير صالحة.');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('تخزين جلسة الحساب المشفر غير متاح على هذا الجهاز.');
    const encrypted = safeStorage.encryptString(JSON.stringify({ key, value }));
    fs.writeFileSync(authStorageFile(), encrypted.toString('base64'), { encoding: 'utf8', mode: 0o600 });
  });
  ipcMain.handle('auth:storage:remove', (event, key) => {
    if (!isAppOrigin(event.sender.getURL())) throw new Error('مصدر التطبيق غير صالح.');
    if (!isSupabaseAuthKey(key)) throw new Error('مفتاح جلسة الحساب غير صالح.');
    const file = authStorageFile();
    if (fs.existsSync(file)) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('تعذر التحقق من تخزين الجلسة المشفر.');
      try {
        const stored = JSON.parse(safeStorage.decryptString(Buffer.from(fs.readFileSync(file, 'utf8'), 'base64')));
        if (stored?.key === key) fs.unlinkSync(file);
      } catch {
        fs.unlinkSync(file);
      }
    }
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
