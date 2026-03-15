import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsStore } from '../../src/main/settings/settings-store';
import { SecureSecrets, type SafeStorageLike } from '../../src/main/settings/secure-secrets';

const tempDirs: string[] = [];

const fakeSafeStorage: SafeStorageLike = {
  isEncryptionAvailable: () => true,
  encryptString: (plainText) => Buffer.from(plainText, 'utf8'),
  decryptString: (cipherText) => cipherText.toString('utf8')
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('SettingsStore', () => {
  it('persists settings and encrypted key presence', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-settings-'));
    tempDirs.push(dir);

    const secrets = new SecureSecrets(join(dir, 'secrets.enc.json'), fakeSafeStorage);
    const store = new SettingsStore({ baseDir: dir, secrets });

    store.saveSettings({
      firstRunAcknowledged: true,
      llmProvider: 'anthropic',
      deepgramApiKey: 'dg-test'
    });

    const loaded = store.getSettings();
    expect(loaded.firstRunAcknowledged).toBe(true);
    expect(loaded.llmProvider).toBe('anthropic');
    expect(loaded.deepgramApiKeySet).toBe(true);
    expect(loaded.openaiApiKeySet).toBe(false);
  });

  it('clears secret when empty string is saved', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-settings-'));
    tempDirs.push(dir);

    const secrets = new SecureSecrets(join(dir, 'secrets.enc.json'), fakeSafeStorage);
    const store = new SettingsStore({ baseDir: dir, secrets });

    store.saveSettings({ openaiApiKey: 'abc123' });
    expect(store.getSettings().openaiApiKeySet).toBe(true);

    store.saveSettings({ openaiApiKey: '' });
    expect(store.getSettings().openaiApiKeySet).toBe(false);
  });

});

