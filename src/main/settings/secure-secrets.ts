import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { safeStorage } from 'electron';

export interface SafeStorageLike {
  isEncryptionAvailable: () => boolean;
  encryptString: (plainText: string) => Buffer;
  decryptString: (cipherText: Buffer) => string;
}

interface PersistedSecrets {
  values: Record<string, string>;
}

function emptySecrets(): PersistedSecrets {
  return { values: {} };
}

export class SecureSecrets {
  private readonly filePath: string;
  private readonly storage: SafeStorageLike;

  public constructor(filePath: string, storage: SafeStorageLike = safeStorage) {
    this.filePath = filePath;
    this.storage = storage;
  }

  public has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  public get(name: string): string | undefined {
    const persisted = this.read();
    const encrypted = persisted.values[name];
    if (!encrypted) {
      return undefined;
    }
    if (!this.storage.isEncryptionAvailable()) {
      return undefined;
    }
    return this.storage.decryptString(Buffer.from(encrypted, 'base64'));
  }

  public set(name: string, value: string): void {
    if (!this.storage.isEncryptionAvailable()) {
      throw new Error('Secure storage is unavailable on this system.');
    }

    const persisted = this.read();
    if (value.trim().length === 0) {
      delete persisted.values[name];
    } else {
      persisted.values[name] = this.storage.encryptString(value).toString('base64');
    }
    this.write(persisted);
  }

  private read(): PersistedSecrets {
    if (!existsSync(this.filePath)) {
      return emptySecrets();
    }

    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedSecrets>;
      if (!parsed.values || typeof parsed.values !== 'object') {
        return emptySecrets();
      }
      return {
        values: Object.fromEntries(
          Object.entries(parsed.values).filter(([, value]) => typeof value === 'string')
        )
      };
    } catch {
      return emptySecrets();
    }
  }

  private write(payload: PersistedSecrets): void {
    writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
