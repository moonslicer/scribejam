import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
      defaultTemplateId: 'standup',
      deepgramApiKey: 'dg-test'
    });

    const loaded = store.getSettings();
    expect(loaded.firstRunAcknowledged).toBe(true);
    expect(loaded.llmProvider).toBe('anthropic');
    expect(loaded.defaultTemplateId).toBe('standup');
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

  it('defaults the template selection to auto on a new store', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-settings-'));
    tempDirs.push(dir);

    const secrets = new SecureSecrets(join(dir, 'secrets.enc.json'), fakeSafeStorage);
    const store = new SettingsStore({ baseDir: dir, secrets });

    expect(store.getSettings().defaultTemplateId).toBe('auto');
  });

  it('falls back to defaults when the persisted template id is invalid', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-settings-'));
    tempDirs.push(dir);

    const secrets = new SecureSecrets(join(dir, 'secrets.enc.json'), fakeSafeStorage);
    const store = new SettingsStore({ baseDir: dir, secrets });

    store.saveSettings({ llmProvider: 'anthropic', defaultTemplateId: 'standup' });
    const settingsPath = join(dir, 'settings.json');
    const persisted = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      firstRunAcknowledged: boolean;
      sttProvider: string;
      llmProvider: string;
      defaultTemplateId: string;
    };
    persisted.defaultTemplateId = 'broken-template';
    writeFileSync(settingsPath, JSON.stringify(persisted, null, 2), 'utf8');

    expect(store.getSettings()).toMatchObject({
      firstRunAcknowledged: false,
      sttProvider: 'deepgram',
      llmProvider: 'openai',
      defaultTemplateId: 'auto'
    });
  });

  it('upgrades persisted settings without a template id to auto', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-settings-'));
    tempDirs.push(dir);

    const secrets = new SecureSecrets(join(dir, 'secrets.enc.json'), fakeSafeStorage);
    const store = new SettingsStore({ baseDir: dir, secrets });

    writeFileSync(
      join(dir, 'settings.json'),
      JSON.stringify(
        {
          firstRunAcknowledged: true,
          sttProvider: 'deepgram',
          llmProvider: 'anthropic'
        },
        null,
        2
      ),
      'utf8'
    );

    expect(store.getSettings()).toMatchObject({
      firstRunAcknowledged: true,
      sttProvider: 'deepgram',
      llmProvider: 'anthropic',
      defaultTemplateId: 'auto'
    });
  });

  it('round-trips a custom template through persisted settings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-settings-'));
    tempDirs.push(dir);

    const secrets = new SecureSecrets(join(dir, 'secrets.enc.json'), fakeSafeStorage);
    const store = new SettingsStore({ baseDir: dir, secrets });
    const templateId = 'cust_customer_interview';

    store.saveSettings({
      defaultTemplateId: templateId,
      customTemplates: [
        {
          id: templateId,
          name: 'Customer interview',
          instructions: 'Focus on pain points and requests.'
        }
      ]
    });

    expect(store.getSettings()).toMatchObject({
      defaultTemplateId: templateId,
      customTemplates: [
        {
          id: templateId,
          name: 'Customer interview',
          instructions: 'Focus on pain points and requests.'
        }
      ]
    });
  });

  it('drops an invalid persisted custom template but keeps the rest of settings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-settings-'));
    tempDirs.push(dir);

    const secrets = new SecureSecrets(join(dir, 'secrets.enc.json'), fakeSafeStorage);
    const store = new SettingsStore({ baseDir: dir, secrets });

    writeFileSync(
      join(dir, 'settings.json'),
      JSON.stringify(
        {
          firstRunAcknowledged: true,
          sttProvider: 'deepgram',
          llmProvider: 'anthropic',
          defaultTemplateId: 'custom',
          customTemplate: {
            name: '',
            instructions: ''
          }
        },
        null,
        2
      ),
      'utf8'
    );

    expect(store.getSettings()).toMatchObject({
      firstRunAcknowledged: true,
      sttProvider: 'deepgram',
      llmProvider: 'anthropic',
      defaultTemplateId: 'auto'
    });
    expect(store.getSettings().customTemplates).toBeUndefined();
  });
});
