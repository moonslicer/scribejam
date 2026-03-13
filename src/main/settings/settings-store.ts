import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { Settings, SettingsSaveRequest } from '../../shared/ipc';
import { SecureSecrets } from './secure-secrets';

interface PersistedSettings {
  firstRunAcknowledged: boolean;
  sttProvider: Settings['sttProvider'];
  llmProvider: Settings['llmProvider'];
}

const DEFAULT_SETTINGS: PersistedSettings = {
  firstRunAcknowledged: false,
  sttProvider: 'deepgram',
  llmProvider: 'openai'
};

export class SettingsStore {
  private readonly settingsPath: string;
  private readonly secrets: SecureSecrets;

  public constructor(options?: { baseDir?: string; secrets?: SecureSecrets }) {
    const baseDir = options?.baseDir ?? app.getPath('userData');
    this.settingsPath = join(baseDir, 'settings.json');
    this.secrets = options?.secrets ?? new SecureSecrets(join(baseDir, 'secrets.enc.json'));
  }

  public getSettings(): Settings {
    const persisted = this.readSettings();
    return {
      firstRunAcknowledged: persisted.firstRunAcknowledged,
      sttProvider: persisted.sttProvider,
      llmProvider: persisted.llmProvider,
      deepgramApiKeySet: this.secrets.has('deepgramApiKey'),
      openaiApiKeySet: this.secrets.has('openaiApiKey'),
      anthropicApiKeySet: this.secrets.has('anthropicApiKey')
    };
  }

  public saveSettings(update: SettingsSaveRequest): void {
    const next = this.readSettings();

    if (update.firstRunAcknowledged !== undefined) {
      next.firstRunAcknowledged = update.firstRunAcknowledged;
    }
    if (update.sttProvider !== undefined) {
      next.sttProvider = update.sttProvider;
    }
    if (update.llmProvider !== undefined) {
      next.llmProvider = update.llmProvider;
    }

    if (update.deepgramApiKey !== undefined) {
      this.secrets.set('deepgramApiKey', update.deepgramApiKey);
    }
    if (update.openaiApiKey !== undefined) {
      this.secrets.set('openaiApiKey', update.openaiApiKey);
    }
    if (update.anthropicApiKey !== undefined) {
      this.secrets.set('anthropicApiKey', update.anthropicApiKey);
    }

    this.writeSettings(next);
  }

  public getSecret(
    name: 'deepgramApiKey' | 'openaiApiKey' | 'anthropicApiKey'
  ): string | undefined {
    return this.secrets.get(name);
  }

  private readSettings(): PersistedSettings {
    if (!existsSync(this.settingsPath)) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const raw = readFileSync(this.settingsPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      if (
        typeof parsed.firstRunAcknowledged !== 'boolean' ||
        parsed.sttProvider !== 'deepgram' ||
        (parsed.llmProvider !== 'openai' && parsed.llmProvider !== 'anthropic')
      ) {
        return { ...DEFAULT_SETTINGS };
      }

      return {
        firstRunAcknowledged: parsed.firstRunAcknowledged,
        sttProvider: parsed.sttProvider,
        llmProvider: parsed.llmProvider
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private writeSettings(settings: PersistedSettings): void {
    writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }
}
