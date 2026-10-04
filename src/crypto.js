import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Sunucu anahtarıyla (CONFIG_SECRET) veriyi AES-256-GCM ile şifreler.
 * Çıktı adreste kullanılabilecek base64url metnidir; anahtar olmadan okunamaz ve değiştirilemez.
 */
export function createSealer(secret) {
  if (!secret) return null;
  const key = createHash('sha256').update(secret).digest();
  return {
    seal(value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
    },
    open(text) {
      try {
        const buf = Buffer.from(String(text), 'base64url');
        if (buf.length < 29) return null;
        const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
        decipher.setAuthTag(buf.subarray(12, 28));
        return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'));
      } catch {
        return null;
      }
    },
  };
}
