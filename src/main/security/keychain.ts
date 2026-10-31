import { safeStorage, app } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class KeychainService {
  private fallbackKey: Buffer;
  private secretsPath: string;
  private memoryCache: Map<string, string> = new Map();

  constructor(storageDir: string) {
    this.secretsPath = path.join(storageDir, 'secrets.enc');
    this.fallbackKey = this.deriveFallbackKey();
    this.loadSecrets();
  }

  private deriveFallbackKey(): Buffer {
    const machineId = `${process.env.USER || process.env.USERNAME || 'user'}-${process.platform}-${app?.getPath('userData') || 'antror'}`;
    return crypto.scryptSync(machineId, 'antror-salt-secure-desktop-ai-2025', 32);
  }

  private loadSecrets(): void {
    if (!fs.existsSync(this.secretsPath)) return;
    try {
      const raw = fs.readFileSync(this.secretsPath, 'utf8');
      const data = JSON.parse(raw);
      for (const [key, encVal] of Object.entries(data)) {
        if (typeof encVal === 'string') {
          const decrypted = this.decrypt(encVal);
          if (decrypted !== null) {
            this.memoryCache.set(key, decrypted);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load encrypted secrets:', err);
    }
  }

  private saveSecrets(): void {
    try {
      const data: Record<string, string> = {};
      for (const [key, val] of this.memoryCache.entries()) {
        const encrypted = this.encrypt(val);
        data[key] = encrypted;
      }
      fs.mkdirSync(path.dirname(this.secretsPath), { recursive: true });
      fs.writeFileSync(this.secretsPath, JSON.stringify(data, null, 2), { mode: 0o600 });
    } catch (err) {
      console.error('Failed to save encrypted secrets:', err);
    }
  }

  public encrypt(plainText: string): string {
    if (!plainText) return '';
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      try {
        const encryptedBuffer = safeStorage.encryptString(plainText);
        return `safe:${encryptedBuffer.toString('base64')}`;
      } catch (e) {
        console.warn('safeStorage encryption failed, falling back to AES-256-GCM:', e);
      }
    }

    // Fallback: AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.fallbackKey, iv);
    let enc = cipher.update(plainText, 'utf8', 'base64');
    enc += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `aes:${iv.toString('base64')}:${authTag.toString('base64')}:${enc}`;
  }

  public decrypt(cipherText: string): string | null {
    if (!cipherText) return '';
    try {
      if (cipherText.startsWith('safe:')) {
        const base64Data = cipherText.slice(5);
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
          const buffer = Buffer.from(base64Data, 'base64');
          return safeStorage.decryptString(buffer);
        }
      } else if (cipherText.startsWith('aes:')) {
        const parts = cipherText.split(':');
        if (parts.length === 4) {
          const iv = Buffer.from(parts[1], 'base64');
          const authTag = Buffer.from(parts[2], 'base64');
          const enc = parts[3];
          const decipher = crypto.createDecipheriv('aes-256-gcm', this.fallbackKey, iv);
          decipher.setAuthTag(authTag);
          let dec = decipher.update(enc, 'base64', 'utf8');
          dec += decipher.final('utf8');
          return dec;
        }
      }
      return null;
    } catch (e) {
      console.error('Failed to decrypt secret:', e);
      return null;
    }
  }

  public setSecret(key: string, secret: string): void {
    if (!secret) {
      this.memoryCache.delete(key);
    } else {
      this.memoryCache.set(key, secret);
    }
    this.saveSecrets();
  }

  public getSecret(key: string): string | undefined {
    return this.memoryCache.get(key);
  }

  public deleteSecret(key: string): void {
    this.memoryCache.delete(key);
    this.saveSecrets();
  }
}
