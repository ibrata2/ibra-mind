const DEFAULT_FS = require('node:fs');

function createEncryptedAuthStorage({ safeStorage, filePath, fs = DEFAULT_FS }) {
  const validKey = (key) => typeof key === 'string' && /^sb-[a-z0-9-]+-auth-token$/.test(key);
  const ensureAvailable = () => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('تخزين جلسة الحساب المشفر غير متاح على هذا الجهاز.');
  };

  return {
    get(key) {
      if (!validKey(key)) throw new Error('مفتاح جلسة الحساب غير صالح.');
      const file = filePath();
      if (!fs.existsSync(file)) return null;
      ensureAvailable();
      try {
        const stored = JSON.parse(safeStorage.decryptString(Buffer.from(fs.readFileSync(file, 'utf8'), 'base64')));
        return stored?.key === key && typeof stored.value === 'string' ? stored.value : null;
      } catch {
        fs.unlinkSync(file);
        return null;
      }
    },
    set(key, value) {
      if (!validKey(key) || typeof value !== 'string' || value.length > 128_000) throw new Error('بيانات جلسة الحساب غير صالحة.');
      ensureAvailable();
      const encrypted = safeStorage.encryptString(JSON.stringify({ key, value }));
      fs.writeFileSync(filePath(), encrypted.toString('base64'), { encoding: 'utf8', mode: 0o600 });
    },
    remove(key) {
      if (!validKey(key)) throw new Error('مفتاح جلسة الحساب غير صالح.');
      const file = filePath();
      if (!fs.existsSync(file)) return;
      ensureAvailable();
      try {
        const stored = JSON.parse(safeStorage.decryptString(Buffer.from(fs.readFileSync(file, 'utf8'), 'base64')));
        if (stored?.key === key) fs.unlinkSync(file);
      } catch {
        fs.unlinkSync(file);
      }
    },
  };
}

module.exports = { createEncryptedAuthStorage };
